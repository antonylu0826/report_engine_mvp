import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { handleChangeTool } from "./changeTools";
import { normalizeToolReply, toolFailure } from "./results";
import { ReportConflictError } from "../server/reportRepository";
import { conditionalStylesByControl } from "../report/presentationCapabilities";

/**
 * Report Engine MCP Server (Pixel-Level Banded Architecture)
 * Exposes Agent-Native Pixel-Level Layout Tools via Model Context Protocol (MCP).
 * Compatible with Cursor, Claude Desktop, Antigravity, and other MCP clients.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { renderReportPdf } from "../server/pdfService";

import type { ReportDefinition, ControlDefinition } from "../types/report.js";
import type {
  ReportDocument,
  ReportDocumentRepository,
} from "../types/document";
import { childSchema } from "../report/dataSchema";
import type { DataSourceSchema } from "../types/datasource";
import { validateReportDocument } from "../report/validateDocument";
import { parseDataSource } from "../data/schema";
import {
  inspectReportLayout,
  renderReportToSvg,
} from "../inspector/layoutInspector.js";

import { reportTools } from "./tools";
import { getPageGeometry } from "../report/geometry";
import {
  deleteControl,
  patchControl,
  updateReportBand,
  updateReportScope,
} from "../report/operations";
import { parseReport } from "../report/schema";
import { getFormulaCatalog } from "../formula/registry";
import { handleFormulaTool } from "./formulaTools";

export interface ReportMcpOptions {
  repository: ReportDocumentRepository;
  initialDocument: ReportDocument;
  outputDirectory?: string;
  assetsDirectory?: string;
}

function describeChildren(
  report: ReportDefinition,
  schema: DataSourceSchema,
  parentPath: string[] = [],
): unknown[] {
  return report.bands.flatMap((band) =>
    band.controls.flatMap((control) => {
      if (!control.subReportDefinition) return [];
      const fields = childSchema(control, schema)!;
      const controlPath = [...parentPath, control.id];
      return [
        {
          subReportControlId: control.id,
          controlPath,
          calculatedFields: control.subReportDefinition.calculatedFields ?? [],
          detailFields: fields.detailFields,
        },
        ...describeChildren(control.subReportDefinition, fields, controlPath),
      ];
    }),
  );
}

/** Creates an unconnected MCP adapter. Importing this module does not open files or transports. */
export function createReportMcpServer(options: ReportMcpOptions) {
  const PROJECT_ROOT = path.resolve(options.outputDirectory ?? process.cwd());
  const ASSETS_DIR = path.resolve(
    options.assetsDirectory ?? path.join(PROJECT_ROOT, ".assets"),
  );
  const storage = {
    read: () => options.repository.read(),
    write: (document: ReportDocument, version?: string) =>
      options.repository.write(validateReportDocument(document), version),
  };
  const server = new Server(
    {
      name: "report-engine-mcp",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: reportTools,
  }));

  // Handle tool execution
  const execute = async (
    request: CallToolRequest,
    snapshot: { version?: string },
  ): Promise<CallToolResult> => {
    // Keep the returned version tied to the data actually read or written by this request.
    const repository = {
      read: async () => {
        const value = await storage.read();
        snapshot.version = value.version;
        return value;
      },
      write: async (document: ReportDocument, version?: string) => {
        const value = await storage.write(document, version);
        snapshot.version = value.version;
        return value;
      },
    };
    const { name, arguments: args } = request.params;
    const changed = await handleChangeTool(name, args, repository);
    if (changed) return changed;
    if (name === "reset_report_layout") {
      if (
        args?.expectedVersion !== undefined &&
        typeof args.expectedVersion !== "string"
      )
        throw new Error("expectedVersion must be a string");
      await repository.write(
        options.initialDocument,
        args?.expectedVersion as string | undefined,
      );
      return {
        content: [{ type: "text", text: "Report and data source reset." }],
      };
    }
    if (name === "get_formula_catalog")
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              await handleFormulaTool(
                name,
                args,
                options.initialDocument.report,
                options.initialDocument.dataSource,
                () => {},
              ),
            ),
          },
        ],
      };
    const current = await repository.read();
    if (args?.expectedVersion !== undefined) {
      if (typeof args.expectedVersion !== "string")
        throw new Error("expectedVersion must be a string");
      if (current.version !== args.expectedVersion)
        throw new ReportConflictError();
    }
    let currentReport = current.report;
    const source = current.dataSource;
    const saveCurrentReport = (report: ReportDefinition) =>
      repository.write(
        { formatVersion: 1, report, dataSource: source },
        current.version,
      );
    const formulaResult = await handleFormulaTool(
      name,
      args,
      currentReport,
      source,
      saveCurrentReport,
    );
    if (formulaResult !== undefined)
      return {
        content: [{ type: "text", text: JSON.stringify(formulaResult) }],
      };
    switch (name) {
      case "get_report_layout": {
        const { printableWidth } = getPageGeometry(currentReport.pageSettings);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  version: current.version,
                  pageInfo: {
                    size: currentReport.pageSettings.size,
                    orientation: currentReport.pageSettings.orientation,
                    margins: currentReport.pageSettings.margins,
                    printableWidth,
                  },
                  report: currentReport,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "get_report_data_source":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                dataSource: source,
                version: current.version,
              }),
            },
          ],
        };
      case "set_report_data_source": {
        const dataSource = parseDataSource(args?.dataSource);
        const report =
          args?.report === undefined ? currentReport : parseReport(args.report);
        const saved = await repository.write(
          { formatVersion: 1, report, dataSource },
          current.version,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                version: saved.version,
                rowCount: dataSource.data.items.length,
              }),
            },
          ],
        };
      }
      case "get_available_data_fields": {
        const fieldMeta = {
          conditionalPrinting: {
            visibleWhen:
              "Boolean expression on bands or controls; null means hidden. Hidden bands collapse space. Hiding rows does not filter aggregate data.",
            styleRules:
              "Ordered matching rules merge; later rules win. Hidden controls skip style/content execution.",
            stylesByControl: conditionalStylesByControl,
          },
          changeWorkflow: [
            "preflight_report",
            "preview_report_changes",
            "apply_report_changes",
          ],
          dataSourceId: source.id,
          dataSourceName: source.name,
          parameters: source.schema.parameters || [],
          detailFields: source.schema.detailFields || [],
          aggregateFormulas: getFormulaCatalog({ category: "aggregate" })
            .functions,
          formulaCatalogTool: "get_formula_catalog",
          calculatedFields: currentReport.calculatedFields ?? [],
          calculatedReference: "calc.<name>",
          childCalculatedFields: describeChildren(currentReport, source.schema),
          systemVariables: getFormulaCatalog().systemVariables,
          sampleParameters: source.data.parameters,
          sampleDetailRecord: source.data.items[0],
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(fieldMeta, null, 2),
            },
          ],
        };
      }

      case "add_control":
      case "update_control":
      case "delete_control":
      case "set_band_height":
      case "set_band_controls": {
        const input = args as {
          bandId: string;
          subReportControlId?: string;
          controlId?: string;
          control?: ControlDefinition;
          patch?: Partial<ControlDefinition>;
          height?: number;
          controls?: ControlDefinition[];
        };
        if (!input || typeof input.bandId !== "string")
          throw new Error("bandId is required");
        currentReport = updateReportScope(
          currentReport,
          (scope) => {
            switch (name) {
              case "add_control": {
                if (!input.control) throw new Error("control is required");
                const control = {
                  ...input.control,
                  id: input.control.id || "ctl-" + crypto.randomUUID(),
                };
                return updateReportBand(scope, input.bandId, (band) => ({
                  ...band,
                  controls: [...band.controls, control],
                }));
              }
              case "update_control":
                if (!input.patch || !input.controlId)
                  throw new Error("controlId and patch are required");
                return patchControl(
                  scope,
                  input.bandId,
                  input.controlId,
                  input.patch,
                );
              case "delete_control":
                if (!input.controlId) throw new Error("controlId is required");
                return deleteControl(scope, input.bandId, input.controlId);
              case "set_band_height":
                if (typeof input.height !== "number")
                  throw new Error("height is required");
                return updateReportBand(scope, input.bandId, (band) => ({
                  ...band,
                  height: input.height!,
                }));
              case "set_band_controls":
                if (!Array.isArray(input.controls))
                  throw new Error("controls must be an array");
                return updateReportBand(scope, input.bandId, (band) => ({
                  ...band,
                  controls: input.controls!,
                }));
              default:
                return scope;
            }
          },
          input.subReportControlId,
        );
        await saveCurrentReport(currentReport);
        return {
          content: [
            { type: "text", text: name + " completed: " + input.bandId },
          ],
        };
      }

      case "batch_update_controls": {
        const updates = args?.updates as Array<{
          bandId: string;
          controlId: string;
          subReportControlId?: string;
          patch: Partial<ControlDefinition>;
        }>;
        if (!Array.isArray(updates) || updates.length === 0)
          throw new Error("updates must be a nonempty array");
        // Apply every patch in order and persist only when the whole batch succeeds.
        for (const update of updates) {
          if (!update.patch || !update.bandId || !update.controlId)
            throw new Error("Invalid control update");
          currentReport = updateReportScope(
            currentReport,
            (scope) =>
              patchControl(
                scope,
                update.bandId,
                update.controlId,
                update.patch,
              ),
            update.subReportControlId,
          );
        }
        await saveCurrentReport(currentReport);
        return {
          content: [
            {
              type: "text",
              text: "Updated " + updates.length + " controls.",
            },
          ],
        };
      }

      case "update_page_settings": {
        const input = args as
          Partial<ReportDefinition["pageSettings"]> | undefined;
        currentReport = {
          ...currentReport,
          pageSettings: {
            ...currentReport.pageSettings,
            ...input,
            margins: {
              ...currentReport.pageSettings.margins,
              ...input?.margins,
            },
          },
        };
        await saveCurrentReport(currentReport);
        const { printableWidth } = getPageGeometry(currentReport.pageSettings);
        return {
          content: [
            {
              type: "text",
              text:
                "Page settings updated. Printable width: " +
                printableWidth.toFixed(1) +
                " pt.",
            },
          ],
        };
      }

      case "set_full_report": {
        const report = parseReport(args?.report);
        await saveCurrentReport(report);
        return {
          content: [
            {
              type: "text",
              text: `整份報表定義已成功替換，目前包含 ${report.bands.length} 個 Bands。`,
            },
          ],
        };
      }

      case "export_pdf": {
        const {
          outputPath = "export_output.pdf",
          recordCount = source.data.items.length,
        } = (args as { outputPath?: string; recordCount?: number }) || {};
        if (
          !Number.isInteger(recordCount) ||
          recordCount < 0 ||
          recordCount > 10000
        )
          throw new Error("recordCount must be an integer between 0 and 10000");
        const targetFile = path.isAbsolute(outputPath)
          ? outputPath
          : path.resolve(PROJECT_ROOT, outputPath);

        const pdfBuffer = await renderReportPdf({
          report: currentReport,
          data: source.data.items.slice(0, recordCount),
          dataSource: source,
        });

        fs.writeFileSync(targetFile, pdfBuffer);
        const stats = fs.statSync(targetFile);

        return {
          content: [
            {
              type: "text",
              text: `PDF 導出成功！檔案大小: ${(stats.size / 1024).toFixed(1)} KB，路徑: ${targetFile}`,
            },
          ],
        };
      }

      case "inspect_and_preview_layout": {
        const inspection = inspectReportLayout(currentReport);

        // 1. Render and save live SVG snapshot
        fs.mkdirSync(ASSETS_DIR, { recursive: true });
        const svgContent = renderReportToSvg(
          currentReport,
          source.data.items,
          source.data.parameters,
        );
        const svgPath = path.resolve(ASSETS_DIR, "agent_live_preview.svg");
        fs.writeFileSync(svgPath, svgContent, "utf-8");

        // 2. Render and save live PDF
        const pdfPath = path.resolve(ASSETS_DIR, "agent_live_preview.pdf");
        const pdfBuffer = await renderReportPdf({
          report: currentReport,
          data: source.data.items,
          dataSource: source,
        });
        fs.writeFileSync(pdfPath, pdfBuffer);
        const pdfStats = fs.statSync(pdfPath);

        // 3. Construct structured diagnosis report
        let reportText = `## 📊 報表排版幾何健檢與視覺快照\n\n`;
        reportText += `- **總結判定**: ${inspection.isValid ? "✅ 通過 (無破版錯誤)" : "🚨 發現破版錯誤 (需調整控制項座標)"}\n`;
        reportText += `- **紙張規格**: ${inspection.pageSize} (可繪製寬度: ${inspection.printableWidth.toFixed(1)} pt)\n`;
        reportText += `- **結構規模**: ${inspection.totalBands} 個 Bands，共 ${inspection.totalControls} 個像素級控制項\n`;
        reportText += `- **SVG 向量預覽圖**: \`${svgPath}\`\n`;
        reportText += `- **即時 PDF 檔案**: \`${pdfPath}\` (${(pdfStats.size / 1024).toFixed(1)} KB)\n\n`;

        if (inspection.diagnostics.length > 0) {
          reportText += `### ⚠️ 幾何診斷問題清單 (${inspection.diagnostics.length} 項)：\n`;
          inspection.diagnostics.forEach((d, idx) => {
            const icon = d.severity === "error" ? "🚨 [錯誤]" : "⚠️ [警告]";
            reportText += `${idx + 1}. ${icon} **[${d.category.toUpperCase()}]** (${d.bandType}): ${d.message}\n`;
          });
          reportText += "\n";
        } else {
          reportText += `### ✨ 幾何診斷：完全零溢出、零重疊、表格欄位 100% 精準垂直對齊！\n\n`;
        }

        reportText += `### 🗺️ 當前版面區塊輪廓圖 (ASCII Wireframe)：\n\`\`\`text\n${inspection.asciiWireframe}\n\`\`\`\n`;

        return {
          content: [
            {
              type: "text",
              text: reportText,
            },
          ],
        };
      }

      default:
        throw new Error(`未知的工具名稱: ${name}`);
    }
  };
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const snapshot: { version?: string } = {};
    try {
      const result = await execute(request, snapshot);
      return normalizeToolReply(request.params.name, result, snapshot.version);
    } catch (error) {
      let version: string | undefined;
      try {
        version = (await storage.read()).version;
      } catch {
        /* Preserve the original storage error. */
      }
      return toolFailure(request.params.name, error, version);
    }
  });

  return server;
}
