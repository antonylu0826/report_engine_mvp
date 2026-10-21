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
import React from 'react';
import ReactPDF, { Font } from '@react-pdf/renderer';

import type { ReportDefinition, ControlDefinition } from '../types/report.js';
import { sampleOrderReport, sampleOrderData45, sampleOrderData14 } from '../mock/sampleReport.js';
import { ReportPDFDocument } from '../compiler/pdfCompiler.js';
import { inspectReportLayout, renderReportToSvg } from '../inspector/layoutInspector.js';

// Resolve project root based on this script location (src/mcp/index.ts -> root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ASSETS_DIR = path.resolve(PROJECT_ROOT, '.assets');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Register font for node environment
const fontPath = path.resolve(PROJECT_ROOT, 'public/fonts/NotoSansTC.ttf');
if (fs.existsSync(fontPath)) {
  Font.register({
    family: 'AppChineseFont',
    src: fontPath,
  });
}

// State persistence file for pixel-level layout
const LAYOUT_FILE_PATH = path.resolve(PROJECT_ROOT, 'current_report_layout.json');

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
        name: 'get_available_data_fields',
        description: '取得報表可供綁定的資料集欄位清單 (包含明細資料欄位名稱、資料型別、範例值、系統聚合函式及格式化建議)，方便 Agent 精準綁定 fieldName 或撰寫計算公式',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_control',
        description: '在指定 Band 內新增一個精確座標的控制項 (Label, Field, Expression, Line, Image, Barcode, QRCode, CheckBox, Panel)',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: '目標 Band ID (如 band-report-header, band-page-header, band-detail, band-report-footer, band-page-footer)' },
            control: {
              type: 'object',
              description: '控制項定義 (必須包含 type, x, y, width, height, text/fieldName, 以及可選 style)',
              properties: {
                id: { type: 'string', description: '自訂控制項唯一 ID (若未提供則自動生成)' },
                type: { type: 'string', enum: ['Label', 'Field', 'Expression', 'Line', 'Image', 'Barcode', 'QRCode', 'CheckBox', 'Panel'], description: '控制項型別' },
                x: { type: 'number', description: '相對於 Band 左邊界的 X 座標 (pt)' },
                y: { type: 'number', description: '相對於 Band 上邊界的 Y 座標 (pt)' },
                width: { type: 'number', description: '寬度 (pt)' },
                height: { type: 'number', description: '高度 (pt)' },
                text: { type: 'string', description: '靜態文字 (Label, Barcode, QRCode, CheckBox 用)' },
                fieldName: { type: 'string', description: '資料綁定欄位名稱 (Field, Barcode, QRCode, CheckBox 用)' },
                expression: { type: 'string', description: '計算公式 (Expression 用，如 =SUM(amount))' },
                formatString: { type: 'string', description: '格式化 (如 C0, N0)' },
                barcodeFormat: { type: 'string', enum: ['CODE128', 'EAN13', 'UPC', 'CODE39'], description: '條碼碼別 (Barcode 用)' },
                displayValue: { type: 'boolean', description: '是否顯示條碼文字 (Barcode 用)' },
                qrErrorLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'], description: '容錯率等級 (QRCode 用)' },
                checked: { type: 'boolean', description: '預設是否勾選 (CheckBox 用)' },
                panelTitle: { type: 'string', description: '容器標題文字 (Panel 用)' },
                style: { type: 'object', description: '字體大小、顏色、背景色、對齊、邊框寬度/顏色等樣式物件' },
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
        name: 'batch_update_controls',
        description: '一次性批次更新多個控制項的屬性與樣式 (適合整組欄位改字體、微調位置或套用統一風格，大幅節省操作輪次)',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              description: '更新清單陣列',
              items: {
                type: 'object',
                properties: {
                  bandId: { type: 'string', description: '目標 Band ID' },
                  controlId: { type: 'string', description: '欲修改的控制項 ID' },
                  patch: { type: 'object', description: '屬性補丁 (x, y, width, height, text, style 等)' },
                },
                required: ['bandId', 'controlId', 'patch'],
              },
            },
          },
          required: ['updates'],
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
        name: 'update_page_settings',
        description: '更新報表全域頁面設定 (如紙張尺寸 A4/Letter、方向 portrait/landscape、上下左右邊界 margins)',
        inputSchema: {
          type: 'object',
          properties: {
            size: { type: 'string', enum: ['A4', 'Letter'], description: '紙張規格' },
            orientation: { type: 'string', enum: ['portrait', 'landscape'], description: '紙張方向' },
            margins: {
              type: 'object',
              properties: {
                top: { type: 'number', description: '上邊界 (pt)' },
                right: { type: 'number', description: '右邊界 (pt)' },
                bottom: { type: 'number', description: '下邊界 (pt)' },
                left: { type: 'number', description: '左邊界 (pt)' },
              },
              description: '邊界設定 (pt)'
            },
          },
        },
      },
      {
        name: 'reset_report_layout',
        description: '一鍵重置報表版面結構回復為乾淨的企業標準出貨單範本 (若排版錯亂或測試後需還原時使用)',
        inputSchema: {
          type: 'object',
          properties: {},
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
      {
        name: 'inspect_and_preview_layout',
        description: '【Agent 排版感知必備】秒級排版幾何健檢與視覺預覽。自動檢測控制項溢出破版、文字碰撞重疊、表頭與明細欄位垂直對齊度，並同步輸出首頁 SVG 向量圖與實體 PDF 檔案供 Agent 檢閱。',
        inputSchema: {
          type: 'object',
          properties: {},
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

      case 'get_available_data_fields': {
        const fieldMeta = {
          description: '出貨驗收單資料模型與可用欄位規格',
          detailFields: [
            { fieldName: 'index', title: '項次', type: 'number', example: 1 },
            { fieldName: 'sku', title: '品號/SKU', type: 'string', example: 'IT-MBP16-M3M' },
            { fieldName: 'productName', title: '品名規格', type: 'string', example: 'Apple MacBook Pro 16" (M3 Max / 36GB / 1TB)' },
            { fieldName: 'category', title: '品類', type: 'string', example: '資訊運算設備' },
            { fieldName: 'unit', title: '單位', type: 'string', example: '台' },
            { fieldName: 'quantity', title: '數量', type: 'number', example: 3, formatHint: 'N0' },
            { fieldName: 'unitPrice', title: '單價', type: 'number', example: 104900, formatHint: 'C0' },
            { fieldName: 'amount', title: '金額小計', type: 'number', example: 314700, formatHint: 'C0' },
          ],
          aggregateFormulas: [
            { expression: '=SUM(amount)', description: '計算當前報表明細總金額合計', formatHint: 'C0' },
            { expression: '=SUM(quantity)', description: '計算出貨品項總數量', formatHint: 'N0' },
            { expression: '=COUNT()', description: '計算總品項筆數', formatHint: 'N0' },
            { expression: '=AVG(unitPrice)', description: '計算平均單價', formatHint: 'C0' },
          ],
          systemVariables: [
            { tag: '[PageNumber]', description: '當前頁碼 (如 第 [PageNumber] 頁)' },
            { tag: '[TotalPages]', description: '總頁數 (如 共 [TotalPages] 頁)' },
            { tag: '[ExecutionTime]', description: '報表產生列印時間' },
          ],
          sampleRecord: sampleOrderData14[0],
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

      case 'batch_update_controls': {
        const { updates } = args as {
          updates: Array<{
            bandId: string;
            controlId: string;
            patch: Partial<ControlDefinition>;
          }>;
        };

        if (!Array.isArray(updates) || updates.length === 0) {
          throw new Error('請提供非空的 updates 陣列');
        }

        let updatedCount = 0;
        const updatedBands = currentReport.bands.map((b) => {
          const bandUpdates = updates.filter((u) => u.bandId === b.id || u.bandId === b.type);
          if (bandUpdates.length === 0) return b;

          const updatedControls = b.controls.map((c) => {
            const target = bandUpdates.find((u) => u.controlId === c.id);
            if (!target) return c;
            updatedCount++;
            return {
              ...c,
              ...target.patch,
              style: { ...c.style, ...target.patch?.style },
            };
          });

          return { ...b, controls: updatedControls };
        });

        currentReport.bands = updatedBands;
        saveCurrentReport(currentReport);

        return {
          content: [
            {
              type: 'text',
              text: `已成功批次更新 ${updatedCount} 個控制項屬性。`,
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

      case 'update_page_settings': {
        const { size, orientation, margins } = (args as {
          size?: 'A4' | 'Letter';
          orientation?: 'portrait' | 'landscape';
          margins?: { top?: number; right?: number; bottom?: number; left?: number };
        }) || {};

        if (size) currentReport.pageSettings.size = size;
        if (orientation) currentReport.pageSettings.orientation = orientation;
        if (margins) {
          currentReport.pageSettings.margins = {
            ...currentReport.pageSettings.margins,
            ...margins,
          };
        }

        saveCurrentReport(currentReport);

        const printableWidth =
          currentReport.pageSettings.size === 'A4'
            ? (currentReport.pageSettings.orientation === 'landscape' ? 841.89 : 595.28) - (currentReport.pageSettings.margins.left + currentReport.pageSettings.margins.right)
            : (currentReport.pageSettings.orientation === 'landscape' ? 792.0 : 612.0) - (currentReport.pageSettings.margins.left + currentReport.pageSettings.margins.right);

        return {
          content: [
            {
              type: 'text',
              text: `頁面設定已更新：尺寸 ${currentReport.pageSettings.size}，方向 ${currentReport.pageSettings.orientation}，邊界 ${JSON.stringify(currentReport.pageSettings.margins)}，最新可繪寬度: ${printableWidth.toFixed(1)} pt。`,
            },
          ],
        };
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
        const targetFile = path.isAbsolute(outputPath) ? outputPath : path.resolve(PROJECT_ROOT, outputPath);

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

      case 'inspect_and_preview_layout': {
        const inspection = inspectReportLayout(currentReport);

        // 1. Render and save live SVG snapshot
        const svgContent = renderReportToSvg(currentReport, sampleOrderData14);
        const svgPath = path.resolve(ASSETS_DIR, 'agent_live_preview.svg');
        fs.writeFileSync(svgPath, svgContent, 'utf-8');

        // 2. Render and save live PDF
        const pdfPath = path.resolve(ASSETS_DIR, 'agent_live_preview.pdf');
        const pdfDocElement = React.createElement(ReportPDFDocument, {
          report: currentReport,
          data: sampleOrderData14,
        });
        await ReactPDF.renderToFile(pdfDocElement as any, pdfPath);
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
