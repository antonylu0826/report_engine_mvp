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
import React from 'react';
import ReactPDF, { Font } from '@react-pdf/renderer';

import type { ReportDefinition, ControlDefinition } from '../types/report.js';
import { sampleOrderReport, sampleOrderData45 } from '../mock/sampleReport.js';
import { ReportPDFDocument } from '../compiler/pdfCompiler.js';

// Register font for node environment
const fontPath = path.resolve(process.cwd(), 'public/fonts/NotoSansTC.ttf');
if (fs.existsSync(fontPath)) {
  Font.register({
    family: 'AppChineseFont',
    src: fontPath,
  });
}

// State persistence file for pixel-level layout
const LAYOUT_FILE_PATH = path.resolve(process.cwd(), 'current_report_layout.json');

function loadCurrentReport(): ReportDefinition {
  if (fs.existsSync(LAYOUT_FILE_PATH)) {
    try {
      const data = fs.readFileSync(LAYOUT_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    } catch {
      // fallback
    }
  }
  return sampleOrderReport;
}

function saveCurrentReport(report: ReportDefinition): void {
  fs.writeFileSync(LAYOUT_FILE_PATH, JSON.stringify(report, null, 2), 'utf-8');
}

// Initialize layout file if missing
if (!fs.existsSync(LAYOUT_FILE_PATH)) {
  saveCurrentReport(sampleOrderReport);
}

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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_report_layout',
        description: '取得當前整份報表的像素級架構 (包含頁面設定、可繪寬度、各 Band 及其所有控制項精確 X/Y/寬高/邊框與文字樣式)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_control',
        description: '在指定 Band 內新增一個精確座標的控制項 (Label, Field, Expression, Line, Image)',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID (如 band-report-header, band-page-header, band-detail, band-report-footer, band-page-footer)' },
            control: {
              type: 'object',
              description: '控制項定義 (必須包含 type, x, y, width, height, text/fieldName, 以及可選 style)',
              properties: {
                id: { type: 'string', description: '自訂控制項唯一 ID (若未提供則自動生成)' },
                type: { type: 'string', enum: ['Label', 'Field', 'Expression', 'Line', 'Image'] },
                x: { type: 'number', description: '相對於 Band 左邊界的 X 座標 (pt)' },
                y: { type: 'number', description: '相對於 Band 上邊界的 Y 座標 (pt)' },
                width: { type: 'number', description: '寬度 (pt)' },
                height: { type: 'number', description: '高度 (pt)' },
                text: { type: 'string', description: '靜態文字 (Label 用)' },
                fieldName: { type: 'string', description: '資料綁定欄位名稱 (Field 用)' },
                expression: { type: 'string', description: '計算公式 (Expression 用，如 =SUM(amount))' },
                formatString: { type: 'string', description: '格式化 (如 C0, N0)' },
                style: { type: 'object', description: '字體大小、對齊、邊框寬度與顏色、背景色等樣式' },
              },
              required: ['type', 'x', 'y', 'width', 'height'],
            },
          },
          required: ['bandId', 'control'],
        },
      },
      {
        name: 'update_control',
        description: '修改指定 Band 內特定控制項的座標 (x, y)、尺寸 (width, height)、文字內容或樣式屬性',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID' },
            controlId: { type: 'string', description: '欲修改的控制項 ID' },
            patch: {
              type: 'object',
              description: '要覆蓋修改的屬性物件 (可包含 x, y, width, height, text, fieldName, style 等)',
            },
          },
          required: ['bandId', 'controlId', 'patch'],
        },
      },
      {
        name: 'delete_control',
        description: '從指定 Band 中刪除特定控制項',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID' },
            controlId: { type: 'string', description: '欲刪除的控制項 ID' },
          },
          required: ['bandId', 'controlId'],
        },
      },
      {
        name: 'set_band_height',
        description: '調整指定 Band 的物理高度 (pt)',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID' },
            height: { type: 'number', description: '新的 Band 高度 (pt)' },
          },
          required: ['bandId', 'height'],
        },
      },
      {
        name: 'set_band_controls',
        description: '批次置換某個 Band 的全部控制項陣列 (非常適合 Agent 一次性排好整組客戶資訊卡、表頭或核決章矩陣)',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID' },
            controls: {
              type: 'array',
              description: '新的控制項物件陣列',
              items: { type: 'object' },
            },
          },
          required: ['bandId', 'controls'],
        },
      },
      {
        name: 'set_full_report',
        description: '直接替換整份報表的 ReportDefinition (適合 Agent 一次性生成整張全新架構單據)',
        inputSchema: {
          type: 'object',
          properties: {
            report: { type: 'object', description: '完整的 ReportDefinition 物件' },
          },
          required: ['report'],
        },
      },
      {
        name: 'export_pdf',
        description: '使用當前的像素級架構與資料渲染出正式 PDF 檔案，供外部檢查排版與邊框效果',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: {
              type: 'string',
              description: '輸出的 PDF 檔案路徑 (預設為 export_output.pdf)',
            },
            recordCount: {
              type: 'number',
              description: '產生的測試筆數 (預設 45 筆以測試多頁跨頁與表頭重複效果)',
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const currentReport = loadCurrentReport();

  try {
    switch (name) {
      case 'get_report_layout': {
        const printableWidth =
          currentReport.pageSettings.size === 'A4'
            ? 595.28 - (currentReport.pageSettings.margins.left + currentReport.pageSettings.margins.right)
            : 612.0 - (currentReport.pageSettings.margins.left + currentReport.pageSettings.margins.right);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  pageInfo: {
                    size: currentReport.pageSettings.size,
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

      case 'add_control': {
        const { bandId, control } = args as {
          bandId: string;
          control: Partial<ControlDefinition> & { type: string; x: number; y: number; width: number; height: number };
        };
        const newId = control.id || `ctl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const fullControl: ControlDefinition = {
          ...control,
          id: newId,
        } as ControlDefinition;

        let found = false;
        const updatedBands = currentReport.bands.map((b) => {
          if (b.id === bandId || b.type === bandId) {
            found = true;
            return {
              ...b,
              controls: [...b.controls, fullControl],
            };
          }
          return b;
        });

        if (!found) {
          throw new Error(`找不到指定的 Band: ${bandId}`);
        }

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已成功在 ${bandId} 新增控制項 (ID: ${newId})，座標為 (${fullControl.x}, ${fullControl.y})，寬高為 ${fullControl.width}x${fullControl.height}。`,
            },
          ],
        };
      }

      case 'update_control': {
        const { bandId, controlId, patch } = args as {
          bandId: string;
          controlId: string;
          patch: Partial<ControlDefinition>;
        };

        let found = false;
        const updatedBands = currentReport.bands.map((b) => {
          if (b.id === bandId || b.type === bandId) {
            return {
              ...b,
              controls: b.controls.map((c) => {
                if (c.id === controlId) {
                  found = true;
                  return {
                    ...c,
                    ...patch,
                    style: { ...c.style, ...patch.style },
                  };
                }
                return c;
              }),
            };
          }
          return b;
        });

        if (!found) {
          throw new Error(`在 ${bandId} 找不到控制項 ID: ${controlId}`);
        }

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已成功更新控制項 ${controlId} 的屬性。`,
            },
          ],
        };
      }

      case 'delete_control': {
        const { bandId, controlId } = args as { bandId: string; controlId: string };
        let found = false;
        const updatedBands = currentReport.bands.map((b) => {
          if (b.id === bandId || b.type === bandId) {
            const initialLen = b.controls.length;
            const filtered = b.controls.filter((c) => c.id !== controlId);
            if (filtered.length !== initialLen) found = true;
            return { ...b, controls: filtered };
          }
          return b;
        });

        if (!found) {
          throw new Error(`在 ${bandId} 找不到控制項 ID: ${controlId}`);
        }

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已成功刪除控制項 ${controlId}。`,
            },
          ],
        };
      }

      case 'set_band_height': {
        const { bandId, height } = args as { bandId: string; height: number };
        let found = false;
        const updatedBands = currentReport.bands.map((b) => {
          if (b.id === bandId || b.type === bandId) {
            found = true;
            return { ...b, height };
          }
          return b;
        });

        if (!found) {
          throw new Error(`找不到指定的 Band: ${bandId}`);
        }

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已將 Band ${bandId} 高度設定為 ${height} pt。`,
            },
          ],
        };
      }

      case 'set_band_controls': {
        const { bandId, controls } = args as { bandId: string; controls: ControlDefinition[] };
        let found = false;
        const updatedBands = currentReport.bands.map((b) => {
          if (b.id === bandId || b.type === bandId) {
            found = true;
            return { ...b, controls };
          }
          return b;
        });

        if (!found) {
          throw new Error(`找不到指定的 Band: ${bandId}`);
        }

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已成功為 ${bandId} 批次置入 ${controls.length} 個控制項。`,
            },
          ],
        };
      }

      case 'set_full_report': {
        const { report } = args as { report: ReportDefinition };
        if (!report.bands || !Array.isArray(report.bands)) {
          throw new Error('無效的 ReportDefinition 物件');
        }
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
        const { outputPath = 'export_output.pdf' } = (args as { outputPath?: string; recordCount?: number }) || {};
        const targetFile = path.resolve(process.cwd(), outputPath);

        const pdfDocElement = React.createElement(ReportPDFDocument, {
          report: currentReport,
          data: sampleOrderData45,
        });

        await ReactPDF.renderToFile(pdfDocElement as any, targetFile);
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

      default:
        throw new Error(`未知的工具名稱: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `工具執行失敗: ${(error as Error).message}`,
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
