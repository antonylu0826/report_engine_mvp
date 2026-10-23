#!/usr/bin/env node

/**
 * Report Engine MCP Server (Pixel-Level Banded Architecture)
 * Exposes Agent-Native Pixel-Level Layout Tools via Model Context Protocol (MCP).
 * Compatible with Cursor, Claude Desktop, Antigravity, and other MCP clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderReportPdf } from '../server/pdfService';

import type { ReportDefinition, ControlDefinition } from '../types/report.js';
import { sampleOrderReport, generateOrderItems, sampleOrderData14, sampleOrderDataSource } from '../mock/sampleReport.js';
import { inspectReportLayout, renderReportToSvg } from '../inspector/layoutInspector.js';

import { reportTools } from './tools';
import { getPageGeometry } from '../report/geometry';
import { deleteControl, patchControl, updateReportBand, updateReportScope } from '../report/operations';
import { parseReport } from '../report/schema';
import { createReportRepository } from '../server/reportRepository';
import { getFormulaCatalog } from '../formula/registry';
import { FormulaError } from '../formula/types';
import { handleFormulaTool } from './formulaTools';

// Resolve project root based on this script location (src/mcp/index.ts -> root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = process.env.REPORT_ENGINE_ASSETS_DIR || path.resolve(PROJECT_ROOT, '.assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// State persistence file for pixel-level layout
const LAYOUT_FILE_PATH = process.env.REPORT_ENGINE_LAYOUT_FILE || path.resolve(PROJECT_ROOT, 'current_report_layout.json');
const repository = createReportRepository(LAYOUT_FILE_PATH, sampleOrderDataSource.schema);
repository.initialize(sampleOrderReport);
const loadCurrentReport = () => repository.read().report;
const saveCurrentReport = (report: ReportDefinition) => repository.write(report);

const server = new Server(
  {
    name: 'report-engine-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: reportTools }));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let currentReport = name === 'reset_report_layout' || name === 'set_full_report' || name === 'get_formula_catalog'
      ? structuredClone(sampleOrderReport) : loadCurrentReport();
    const formulaResult = handleFormulaTool(name, args, currentReport, sampleOrderDataSource, saveCurrentReport);
    if (formulaResult !== undefined) return { content: [{ type: 'text', text: JSON.stringify(formulaResult) }] };
    switch (name) {
      case 'get_report_layout': {
        const { printableWidth } = getPageGeometry(currentReport.pageSettings);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  pageInfo: {
                    size: currentReport.pageSettings.size,
                    orientation: currentReport.pageSettings.orientation,
                    margins: currentReport.pageSettings.margins,
                    printableWidth,
                  },
                  report: currentReport,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_available_data_fields': {
        const fieldMeta = {
          dataSourceId: sampleOrderDataSource.id,
          dataSourceName: sampleOrderDataSource.name,
          parameters: sampleOrderDataSource.schema.parameters || [],
          detailFields: sampleOrderDataSource.schema.detailFields || [],
          aggregateFormulas: getFormulaCatalog({ category: 'aggregate' }).functions,
          formulaCatalogTool: 'get_formula_catalog',
          calculatedFields: currentReport.calculatedFields ?? [],
          calculatedReference: 'calc.<name>',
          childCalculatedFields: currentReport.bands.flatMap(b => b.controls.filter(c => c.subReportDefinition).map(c => ({ subReportControlId: c.id, calculatedFields: c.subReportDefinition!.calculatedFields ?? [], detailFields: sampleOrderDataSource.schema.detailFields.find(f => f.name === c.subReportBinding)?.children ?? [] }))),
          systemVariables: getFormulaCatalog().systemVariables,
          sampleParameters: sampleOrderDataSource.data.parameters,
          sampleDetailRecord: sampleOrderDataSource.data.items[0],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(fieldMeta, null, 2),
            },
          ],
        };
      }

      case 'add_control':
      case 'update_control':
      case 'delete_control':
      case 'set_band_height':
      case 'set_band_controls': {
        const input = args as {
          bandId: string; subReportControlId?: string; controlId?: string;
          control?: ControlDefinition; patch?: Partial<ControlDefinition>;
          height?: number; controls?: ControlDefinition[];
        };
        if (!input || typeof input.bandId !== 'string') throw new Error('bandId is required');
        currentReport = updateReportScope(currentReport, scope => {
          switch (name) {
            case 'add_control': {
              if (!input.control) throw new Error('control is required');
              const control = { ...input.control, id: input.control.id || 'ctl-' + crypto.randomUUID() };
              return updateReportBand(scope, input.bandId, band => ({ ...band, controls: [...band.controls, control] }));
            }
            case 'update_control':
              if (!input.patch || !input.controlId) throw new Error('controlId and patch are required');
              return patchControl(scope, input.bandId, input.controlId, input.patch);
            case 'delete_control':
              if (!input.controlId) throw new Error('controlId is required');
              return deleteControl(scope, input.bandId, input.controlId);
            case 'set_band_height':
              if (typeof input.height !== 'number') throw new Error('height is required');
              return updateReportBand(scope, input.bandId, band => ({ ...band, height: input.height! }));
            case 'set_band_controls':
              if (!Array.isArray(input.controls)) throw new Error('controls must be an array');
              return updateReportBand(scope, input.bandId, band => ({ ...band, controls: input.controls! }));
            default: return scope;
          }
        }, input.subReportControlId);
        saveCurrentReport(currentReport);
        return { content: [{ type: 'text', text: name + ' completed: ' + input.bandId }] };
      }

      case 'batch_update_controls': {
        const updates = args?.updates as Array<{
          bandId: string; controlId: string; subReportControlId?: string; patch: Partial<ControlDefinition>;
        }>;
        if (!Array.isArray(updates) || updates.length === 0) throw new Error('updates must be a nonempty array');
        // Apply every patch in order and persist only when the whole batch succeeds.
        for (const update of updates) {
          if (!update.patch || !update.bandId || !update.controlId) throw new Error('Invalid control update');
          currentReport = updateReportScope(currentReport, scope =>
            patchControl(scope, update.bandId, update.controlId, update.patch), update.subReportControlId);
        }
        saveCurrentReport(currentReport);
        return { content: [{ type: 'text', text: 'Updated ' + updates.length + ' controls.' }] };
      }

      case 'update_page_settings': {
        const input = args as Partial<ReportDefinition['pageSettings']> | undefined;
        currentReport = {
          ...currentReport,
          pageSettings: {
            ...currentReport.pageSettings, ...input,
            margins: { ...currentReport.pageSettings.margins, ...input?.margins },
          },
        };
        saveCurrentReport(currentReport);
        const { printableWidth } = getPageGeometry(currentReport.pageSettings);
        return { content: [{ type: 'text', text: 'Page settings updated. Printable width: ' + printableWidth.toFixed(1) + ' pt.' }] };
      }

      case 'reset_report_layout': {
        saveCurrentReport(sampleOrderReport);
        return {
          content: [
            {
              type: 'text',
              text: '報表版面已成功重置回復為企業標準出貨單範本！',
            },
          ],
        };
      }

      case 'set_full_report': {
        const report = parseReport(args?.report);
        saveCurrentReport(report);
        return {
          content: [
            {
              type: 'text',
              text: `整份報表定義已成功替換，目前包含 ${report.bands.length} 個 Bands。`,
            },
          ],
        };
      }

      case 'export_pdf': {
        const { outputPath = 'export_output.pdf', recordCount = 45 } = (args as { outputPath?: string; recordCount?: number }) || {};
        if (!Number.isInteger(recordCount) || recordCount < 0 || recordCount > 10000) throw new Error('recordCount must be an integer between 0 and 10000');
        const targetFile = path.isAbsolute(outputPath) ? outputPath : path.resolve(PROJECT_ROOT, outputPath);

        const pdfBuffer = await renderReportPdf({
          report: currentReport,
          data: generateOrderItems(recordCount),
          dataSource: sampleOrderDataSource,
        });

        fs.writeFileSync(targetFile, pdfBuffer);
        const stats = fs.statSync(targetFile);

        return {
          content: [
            {
              type: 'text',
              text: `PDF 導出成功！檔案大小: ${(stats.size / 1024).toFixed(1)} KB，路徑: ${targetFile}`,
            },
          ],
        };
      }

      case 'inspect_and_preview_layout': {
        const inspection = inspectReportLayout(currentReport);

        // 1. Render and save live SVG snapshot
        const svgContent = renderReportToSvg(currentReport, sampleOrderData14, sampleOrderDataSource.data.parameters);
        const svgPath = path.resolve(ASSETS_DIR, 'agent_live_preview.svg');
        fs.writeFileSync(svgPath, svgContent, 'utf-8');

        // 2. Render and save live PDF
        const pdfPath = path.resolve(ASSETS_DIR, 'agent_live_preview.pdf');
        const pdfBuffer = await renderReportPdf({
          report: currentReport,
          data: sampleOrderData14,
          dataSource: sampleOrderDataSource,
        });
        fs.writeFileSync(pdfPath, pdfBuffer);
        const pdfStats = fs.statSync(pdfPath);

        // 3. Construct structured diagnosis report
        let reportText = `## 📊 報表排版幾何健檢與視覺快照\n\n`;
        reportText += `- **總結判定**: ${inspection.isValid ? '✅ 通過 (無破版錯誤)' : '🚨 發現破版錯誤 (需調整控制項座標)'}\n`;
        reportText += `- **紙張規格**: ${inspection.pageSize} (可繪製寬度: ${inspection.printableWidth.toFixed(1)} pt)\n`;
        reportText += `- **結構規模**: ${inspection.totalBands} 個 Bands，共 ${inspection.totalControls} 個像素級控制項\n`;
        reportText += `- **SVG 向量預覽圖**: \`${svgPath}\`\n`;
        reportText += `- **即時 PDF 檔案**: \`${pdfPath}\` (${(pdfStats.size / 1024).toFixed(1)} KB)\n\n`;

        if (inspection.diagnostics.length > 0) {
          reportText += `### ⚠️ 幾何診斷問題清單 (${inspection.diagnostics.length} 項)：\n`;
          inspection.diagnostics.forEach((d, idx) => {
            const icon = d.severity === 'error' ? '🚨 [錯誤]' : '⚠️ [警告]';
            reportText += `${idx + 1}. ${icon} **[${d.category.toUpperCase()}]** (${d.bandType}): ${d.message}\n`;
          });
          reportText += '\n';
        } else {
          reportText += `### ✨ 幾何診斷：完全零溢出、零重疊、表格欄位 100% 精準垂直對齊！\n\n`;
        }

        reportText += `### 🗺️ 當前版面區塊輪廓圖 (ASCII Wireframe)：\n\`\`\`text\n${inspection.asciiWireframe}\n\`\`\`\n`;

        return {
          content: [
            {
              type: 'text',
              text: reportText,
            },
          ],
        };
      }

      default:
        throw new Error(`未知的工具名稱: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: error instanceof FormulaError ? JSON.stringify({ error: error.message, diagnostics: error.diagnostics }) : `工具執行失敗: ${(error as Error).message}`,
        },
      ],
    };
  }
});

// Run server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Report Engine Pixel-Level MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
