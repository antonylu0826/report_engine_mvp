#!/usr/bin/env node

/**
 * Report Engine MCP Server
 * Exposes Agent-Native Report Design Tools via Model Context Protocol (MCP).
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
import React from 'react';
import ReactPDF, { Font } from '@react-pdf/renderer';

import type { SemanticReportSpec, SemanticTheme } from '../semantic/types.js';
import { defaultSemanticSpec } from '../semantic/sampleSpec.js';
import { compileSemanticSpecToReport } from '../semantic/compiler.js';
import {
  addColumn,
  removeColumn,
  updateColumn,
  setTheme,
  setReportTitle,
} from '../semantic/mutations.js';
import { sampleOrderData45 } from '../mock/sampleReport.js';
import { ReportPDFDocument } from '../compiler/pdfCompiler.js';

// Register font for node environment
const fontPath = path.resolve(process.cwd(), 'public/fonts/NotoSansTC.ttf');
if (fs.existsSync(fontPath)) {
  Font.register({
    family: 'AppChineseFont',
    src: fontPath,
  });
}

// State persistence file
const SPEC_FILE_PATH = path.resolve(process.cwd(), 'current_report_spec.json');

function loadCurrentSpec(): SemanticReportSpec {
  if (fs.existsSync(SPEC_FILE_PATH)) {
    try {
      const data = fs.readFileSync(SPEC_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    } catch {
      // fallback
    }
  }
  return defaultSemanticSpec;
}

function saveCurrentSpec(spec: SemanticReportSpec): void {
  fs.writeFileSync(SPEC_FILE_PATH, JSON.stringify(spec, null, 2), 'utf-8');
}

// Initialize spec file if missing
if (!fs.existsSync(SPEC_FILE_PATH)) {
  saveCurrentSpec(defaultSemanticSpec);
}

const server = new Server(
  {
    name: 'report-engine-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_report_spec',
        description: '取得當前報表的高階語意規格 (Semantic Spec DSL，不含複雜物理像素座標)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_report_theme',
        description: '一鍵變更整份報表的主題風格色彩',
        inputSchema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['slate', 'blue', 'emerald', 'purple', 'amber'],
              description: '主題色系：slate(經典灰階), blue(商務深藍), emerald(財會翡翠), purple(現代紫韻), amber(復古暖金)',
            },
          },
          required: ['theme'],
        },
      },
      {
        name: 'set_report_title',
        description: '變更報表的大標題（公司行號名稱）與副標題（單據名稱）',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '公司或機構主標題' },
            subtitle: { type: 'string', description: '單據名稱副標題' },
          },
          required: ['title'],
        },
      },
      {
        name: 'add_report_column',
        description: '在報表中新增一個資料欄位，幾何編譯器會自動重新平衡各欄物理寬度與保證上下對齊',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '欄位唯一代碼 (如 spec, warranty, unit)' },
            label: { type: 'string', description: '表格表頭文字 (如 "規格說明", "保固期")' },
            field: { type: 'string', description: '對應的資料集欄位名稱 (如 "spec")' },
            expression: { type: 'string', description: '或使用計算運算式 (如 "=ROW_INDEX")' },
            format: { type: 'string', description: '數值格式化指令 (如 "C0" 貨幣, "N0" 千分位, "date")' },
            widthWeight: { type: 'number', description: '寬度權重比例 (預設 1.5，大於 1 代表較寬，小於 1 代表較窄)' },
            align: { type: 'string', enum: ['left', 'center', 'right'], description: '對齊方式' },
            summary: { type: 'string', enum: ['SUM', 'AVG', 'COUNT'], description: '是否在頁尾進行自動統計合計' },
            afterColumnId: { type: 'string', description: '指定插入在哪個既有欄位後方 (若不填則加在最後)' },
          },
          required: ['id', 'label'],
        },
      },
      {
        name: 'remove_report_column',
        description: '從報表中刪除指定的欄位',
        inputSchema: {
          type: 'object',
          properties: {
            columnId: { type: 'string', description: '欲刪除的欄位 ID' },
          },
          required: ['columnId'],
        },
      },
      {
        name: 'update_report_column',
        description: '修改既有欄位的屬性（如調整寬度比例、對齊方式、修改文字標籤或格式化）',
        inputSchema: {
          type: 'object',
          properties: {
            columnId: { type: 'string', description: '欄位 ID' },
            label: { type: 'string', description: '修改後的表頭文字' },
            widthWeight: { type: 'number', description: '新的寬度權重' },
            align: { type: 'string', enum: ['left', 'center', 'right'], description: '新的對齊方式' },
            format: { type: 'string', description: '新的格式化指令' },
            summary: { type: 'string', enum: ['SUM', 'AVG', 'COUNT'], description: '頁尾統計方式' },
          },
          required: ['columnId'],
        },
      },
      {
        name: 'compile_and_export_pdf',
        description: '將當前語意報表規格透過幾何編譯器轉譯為 PDF，並輸出實體 PDF 檔案至磁碟',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: { type: 'string', description: '產出之 PDF 儲存路徑 (如 "output.pdf")' },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let currentSpec = loadCurrentSpec();

  try {
    switch (name) {
      case 'get_report_spec': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(currentSpec, null, 2),
            },
          ],
        };
      }

      case 'set_report_theme': {
        const theme = (args?.theme as SemanticTheme) || 'slate';
        currentSpec = setTheme(currentSpec, theme);
        saveCurrentSpec(currentSpec);
        return {
          content: [
            {
              type: 'text',
              text: `已成功將報表全域主題切換為：「${theme}」風格！`,
            },
          ],
        };
      }

      case 'set_report_title': {
        const title = String(args?.title || '');
        const subtitle = args?.subtitle ? String(args?.subtitle) : undefined;
        currentSpec = setReportTitle(currentSpec, title, subtitle);
        saveCurrentSpec(currentSpec);
        return {
          content: [
            {
              type: 'text',
              text: `已成功變更報表抬頭為：「${title}」${subtitle ? `，副標題：「${subtitle}」` : ''}`,
            },
          ],
        };
      }

      case 'add_report_column': {
        const newCol = {
          id: String(args?.id),
          label: String(args?.label),
          field: args?.field ? String(args?.field) : undefined,
          expression: args?.expression ? String(args?.expression) : undefined,
          format: args?.format ? String(args?.format) : undefined,
          widthWeight: Number(args?.widthWeight) || 1.5,
          align: (args?.align as 'left' | 'center' | 'right') || 'left',
          summary: args?.summary as 'SUM' | 'AVG' | 'COUNT' | undefined,
        };
        const afterId = args?.afterColumnId ? String(args?.afterColumnId) : undefined;
        currentSpec = addColumn(currentSpec, newCol, afterId);
        saveCurrentSpec(currentSpec);
        return {
          content: [
            {
              type: 'text',
              text: `已成功新增欄位「${newCol.label}」(${newCol.id})，權重為 ${newCol.widthWeight}。幾何編譯器已自動重新平衡全表欄寬！`,
            },
          ],
        };
      }

      case 'remove_report_column': {
        const colId = String(args?.columnId);
        currentSpec = removeColumn(currentSpec, colId);
        saveCurrentSpec(currentSpec);
        return {
          content: [
            {
              type: 'text',
              text: `已成功從報表中移除欄位 ID：「${colId}」！`,
            },
          ],
        };
      }

      case 'update_report_column': {
        const colId = String(args?.columnId);
        const patch: Record<string, unknown> = {};
        if (args?.label !== undefined) patch.label = String(args.label);
        if (args?.widthWeight !== undefined) patch.widthWeight = Number(args.widthWeight);
        if (args?.align !== undefined) patch.align = args.align;
        if (args?.format !== undefined) patch.format = String(args.format);
        if (args?.summary !== undefined) patch.summary = args.summary;

        currentSpec = updateColumn(currentSpec, colId, patch);
        saveCurrentSpec(currentSpec);
        return {
          content: [
            {
              type: 'text',
              text: `已成功更新欄位「${colId}」的屬性設定！`,
            },
          ],
        };
      }

      case 'compile_and_export_pdf': {
        const targetPath = args?.outputPath
          ? path.resolve(process.cwd(), String(args.outputPath))
          : path.resolve(process.cwd(), `${currentSpec.name || 'report'}.pdf`);

        const compiledReport = compileSemanticSpecToReport(currentSpec);
        const doc = React.createElement(ReportPDFDocument, {
          report: compiledReport,
          data: sampleOrderData45,
        });

        await ReactPDF.renderToFile(doc, targetPath);
        return {
          content: [
            {
              type: 'text',
              text: `✅ PDF 報表編譯成功！檔案已儲存至：${targetPath} (包含 45 筆資料、自動跨頁與中文字型)`,
            },
          ],
        };
      }

      default:
        throw new Error(`未知的工具名稱: ${name}`);
    }
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `操作失敗: ${(err as Error).message}`,
        },
      ],
    };
  }
});

// Start stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Report Engine MCP Server running on stdio');
}

run().catch((err) => {
  console.error('Fatal error in MCP Server:', err);
  process.exit(1);
});
