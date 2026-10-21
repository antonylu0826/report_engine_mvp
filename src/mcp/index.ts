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
import { sampleOrderReport, sampleOrderData45, sampleOrderData14, sampleOrderDataSource } from '../mock/sampleReport.js';
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
        description: 'Get the complete pixel-level report definition (pageSize, printableWidth, bands, and controls with exact x/y/width/height and styles).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_available_data_fields',
        description: 'Get bindable dataset schema including detail fields, data types, sample values, and built-in aggregate formula suggestions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_control',
        description: 'Add a control with precise coordinates into a target band or nested SubReport.',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: 'Target Band ID (e.g., band-page-header, band-detail, sub-band-header, sub-band-detail)' },
            subReportControlId: { type: 'string', description: 'Optional. SubReport control ID if adding into a nested subreport band' },
            control: {
              type: 'object',
              description: 'Control definition object',
              properties: {
                id: { type: 'string', description: 'Unique control ID' },
                type: { type: 'string', enum: ['Label', 'Field', 'Expression', 'Line', 'Image', 'Barcode', 'QRCode', 'CheckBox', 'Panel', 'SubReport'], description: 'Control type' },
                x: { type: 'number', description: 'X position in points (pt) relative to band left' },
                y: { type: 'number', description: 'Y position in points (pt) relative to band top' },
                width: { type: 'number', description: 'Width in points (pt)' },
                height: { type: 'number', description: 'Height in points (pt)' },
                text: { type: 'string', description: 'Static text' },
                fieldName: { type: 'string', description: 'Bound data field name' },
                expression: { type: 'string', description: 'Calculation formula (e.g. =SUM(amount))' },
                formatString: { type: 'string', description: 'Format string (e.g. C0, N0)' },
                barcodeFormat: { type: 'string', enum: ['CODE128', 'EAN13', 'UPC', 'CODE39'], description: 'Barcode format' },
                displayValue: { type: 'boolean', description: 'Whether to show text under barcode' },
                qrErrorLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'], description: 'QR error correction level' },
                checked: { type: 'boolean', description: 'Checkbox checked state' },
                subReportTitle: { type: 'string', description: 'SubReport title' },
                subReportBinding: { type: 'string', description: 'SubReport nested data key (e.g. serials)' },
                style: { type: 'object', description: 'Style object (fontSize, color, backgroundColor, textAlign, borderWidth, borderColor)' },
              },
              required: ['type', 'x', 'y', 'width', 'height'],
            },
          },
          required: ['bandId', 'control'],
        },
      },
      {
        name: 'update_control',
        description: 'Update coordinates, dimensions, text, bindings, or styles of a specific control in a band or nested SubReport.',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: 'Target Band ID' },
            controlId: { type: 'string', description: 'Control ID to update' },
            subReportControlId: { type: 'string', description: 'Optional. SubReport control ID if control is inside a nested subreport' },
            patch: {
              type: 'object',
              description: 'Patch object containing properties to update',
            },
          },
          required: ['bandId', 'controlId', 'patch'],
        },
      },
      {
        name: 'batch_update_controls',
        description: 'Batch update multiple controls in a single call to save turns and tokens.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              description: 'Array of update objects',
              items: {
                type: 'object',
                properties: {
                  bandId: { type: 'string', description: 'Target Band ID' },
                  controlId: { type: 'string', description: 'Control ID' },
                  subReportControlId: { type: 'string', description: 'Optional SubReport control ID' },
                  patch: { type: 'object', description: 'Property patch' },
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
        description: 'Delete a control from a specified band or nested SubReport.',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: 'Target Band ID' },
            controlId: { type: 'string', description: 'Control ID to delete' },
            subReportControlId: { type: 'string', description: 'Optional SubReport control ID' },
          },
          required: ['bandId', 'controlId'],
        },
      },
      {
        name: 'set_band_height',
        description: 'Set physical height (in pt) of a band or nested subreport band.',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: 'Target Band ID' },
            subReportControlId: { type: 'string', description: 'Optional SubReport control ID' },
            height: { type: 'number', description: 'New height in points (pt)' },
          },
          required: ['bandId', 'height'],
        },
      },
      {
        name: 'set_band_controls',
        description: 'Replace all controls in a band with a new array of control definitions.',
        inputSchema: {
          type: 'object',
          properties: {
            bandId: { type: 'string', description: 'Target Band ID' },
            subReportControlId: { type: 'string', description: 'Optional SubReport control ID' },
            controls: {
              type: 'array',
              description: 'New array of control definitions',
              items: { type: 'object' },
            },
          },
          required: ['bandId', 'controls'],
        },
      },
      {
        name: 'update_page_settings',
        description: 'Update global page settings (size, orientation, margins).',
        inputSchema: {
          type: 'object',
          properties: {
            size: { type: 'string', enum: ['A4', 'Letter'], description: 'Paper size' },
            orientation: { type: 'string', enum: ['portrait', 'landscape'], description: 'Page orientation' },
            margins: {
              type: 'object',
              properties: {
                top: { type: 'number', description: 'Top margin (pt)' },
                right: { type: 'number', description: 'Right margin (pt)' },
                bottom: { type: 'number', description: 'Bottom margin (pt)' },
                left: { type: 'number', description: 'Left margin (pt)' },
              },
              description: 'Margins in points'
            },
          },
        },
      },
      {
        name: 'reset_report_layout',
        description: 'Reset report definition back to clean default shipping invoice template.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_full_report',
        description: 'Replace the entire ReportDefinition object.',
        inputSchema: {
          type: 'object',
          properties: {
            report: { type: 'object', description: 'Complete ReportDefinition object' },
          },
          required: ['report'],
        },
      },
      {
        name: 'export_pdf',
        description: 'Compile and render the current report into an actual PDF file on disk.',
        inputSchema: {
          type: 'object',
          properties: {
            outputPath: {
              type: 'string',
              description: 'Target PDF file path (default: export_output.pdf)',
            },
            recordCount: {
              type: 'number',
              description: 'Sample record count (default: 45)',
            },
          },
        },
      },
      {
        name: 'inspect_and_preview_layout',
        description: 'Run geometric health audit (overflow, collision, alignment including nested SubReports) and generate SVG preview snapshot and live PDF.',
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
          dataSourceId: sampleOrderDataSource.id,
          dataSourceName: sampleOrderDataSource.name,
          parameters: sampleOrderDataSource.schema.parameters || [],
          detailFields: sampleOrderDataSource.schema.detailFields || [],
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

      case 'add_control': {
        const { bandId, subReportControlId, control } = args as {
          bandId: string;
          subReportControlId?: string;
          control: Partial<ControlDefinition> & { type: string; x: number; y: number; width: number; height: number };
        };
        const newId = control.id || `ctl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const fullControl: ControlDefinition = {
          ...control,
          id: newId,
        } as ControlDefinition;

        if (subReportControlId) {
          // Add into nested SubReport definition
          let foundSub = false;
          let foundBand = false;
          currentReport.bands.forEach((b) => {
            const subCtrl = b.controls.find((c) => c.id === subReportControlId && c.type === 'SubReport');
            if (subCtrl) {
              foundSub = true;
              if (!subCtrl.subReportDefinition) {
                subCtrl.subReportDefinition = {
                  id: `subdef-${subReportControlId}`,
                  name: subCtrl.subReportTitle || 'SubReport',
                  pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
                  bands: [],
                };
              }
              subCtrl.subReportDefinition.bands = subCtrl.subReportDefinition.bands.map((sb) => {
                if (sb.id === bandId || sb.type === bandId) {
                  foundBand = true;
                  return { ...sb, controls: [...sb.controls, fullControl] };
                }
                return sb;
              });
            }
          });

          if (!foundSub) throw new Error(`找不到指定的 SubReport 控制項: ${subReportControlId}`);
          if (!foundBand) throw new Error(`在 SubReport 內找不到指定的 Band: ${bandId}`);

          saveCurrentReport(currentReport);
          return {
            content: [{ type: 'text', text: `已成功在子報表 [${subReportControlId}] 的區段 ${bandId} 新增控制項 (${newId})。` }],
          };
        }

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
        const { bandId, controlId, subReportControlId, patch } = args as {
          bandId: string;
          controlId: string;
          subReportControlId?: string;
          patch: Partial<ControlDefinition>;
        };

        if (subReportControlId) {
          let foundSub = false;
          let foundCtrl = false;
          currentReport.bands.forEach((b) => {
            const subCtrl = b.controls.find((c) => c.id === subReportControlId && c.type === 'SubReport');
            if (subCtrl && subCtrl.subReportDefinition) {
              foundSub = true;
              subCtrl.subReportDefinition.bands = subCtrl.subReportDefinition.bands.map((sb) => {
                if (sb.id === bandId || sb.type === bandId) {
                  return {
                    ...sb,
                    controls: sb.controls.map((c) => {
                      if (c.id === controlId) {
                        foundCtrl = true;
                        return { ...c, ...patch, style: { ...c.style, ...patch.style } };
                      }
                      return c;
                    }),
                  };
                }
                return sb;
              });
            }
          });

          if (!foundSub) throw new Error(`找不到指定的 SubReport 控制項: ${subReportControlId}`);
          if (!foundCtrl) throw new Error(`在子報表 [${subReportControlId}] 區段 ${bandId} 內找不到控制項: ${controlId}`);

          saveCurrentReport(currentReport);
          return {
            content: [{ type: 'text', text: `已成功更新子報表 [${subReportControlId}] 內的控制項 ${controlId}。` }],
          };
        }

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
            subReportControlId?: string;
            patch: Partial<ControlDefinition>;
          }>;
        };

        if (!Array.isArray(updates) || updates.length === 0) {
          throw new Error('請提供非空的 updates 陣列');
        }

        let updatedCount = 0;
        const updatedBands = currentReport.bands.map((b) => {
          const directUpdates = updates.filter((u) => !u.subReportControlId && (u.bandId === b.id || u.bandId === b.type));

          let newControls = b.controls.map((c) => {
            const target = directUpdates.find((u) => u.controlId === c.id);
            if (target) {
              updatedCount++;
              return {
                ...c,
                ...target.patch,
                style: { ...c.style, ...target.patch?.style },
              };
            }

            // Also check if any updates target inside this SubReport
            if (c.type === 'SubReport' && c.subReportDefinition) {
              const subUpdates = updates.filter((u) => u.subReportControlId === c.id);
              if (subUpdates.length > 0) {
                c.subReportDefinition.bands = c.subReportDefinition.bands.map((sb) => {
                  const sbUpdates = subUpdates.filter((u) => u.bandId === sb.id || u.bandId === sb.type);
                  if (sbUpdates.length === 0) return sb;
                  return {
                    ...sb,
                    controls: sb.controls.map((sc) => {
                      const st = sbUpdates.find((u) => u.controlId === sc.id);
                      if (!st) return sc;
                      updatedCount++;
                      return { ...sc, ...st.patch, style: { ...sc.style, ...st.patch?.style } };
                    }),
                  };
                });
              }
            }

            return c;
          });

          return { ...b, controls: newControls };
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
        const { bandId, controlId, subReportControlId } = args as { bandId: string; controlId: string; subReportControlId?: string };

        if (subReportControlId) {
          let foundSub = false;
          let deleted = false;
          currentReport.bands.forEach((b) => {
            const subCtrl = b.controls.find((c) => c.id === subReportControlId && c.type === 'SubReport');
            if (subCtrl && subCtrl.subReportDefinition) {
              foundSub = true;
              subCtrl.subReportDefinition.bands = subCtrl.subReportDefinition.bands.map((sb) => {
                if (sb.id === bandId || sb.type === bandId) {
                  const prevLen = sb.controls.length;
                  const filtered = sb.controls.filter((c) => c.id !== controlId);
                  if (filtered.length !== prevLen) deleted = true;
                  return { ...sb, controls: filtered };
                }
                return sb;
              });
            }
          });

          if (!foundSub) throw new Error(`找不到指定的 SubReport 控制項: ${subReportControlId}`);
          if (!deleted) throw new Error(`在子報表 [${subReportControlId}] 區段 ${bandId} 內找不到控制項: ${controlId}`);

          saveCurrentReport(currentReport);
          return {
            content: [{ type: 'text', text: `已成功自子報表 [${subReportControlId}] 刪除控制項 ${controlId}。` }],
          };
        }

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
        const { bandId, height, subReportControlId } = args as { bandId: string; height: number; subReportControlId?: string };

        if (subReportControlId) {
          let foundSub = false;
          let foundBand = false;
          currentReport.bands.forEach((b) => {
            const subCtrl = b.controls.find((c) => c.id === subReportControlId && c.type === 'SubReport');
            if (subCtrl && subCtrl.subReportDefinition) {
              foundSub = true;
              subCtrl.subReportDefinition.bands = subCtrl.subReportDefinition.bands.map((sb) => {
                if (sb.id === bandId || sb.type === bandId) {
                  foundBand = true;
                  return { ...sb, height };
                }
                return sb;
              });
            }
          });

          if (!foundSub) throw new Error(`找不到指定的 SubReport 控制項: ${subReportControlId}`);
          if (!foundBand) throw new Error(`在子報表 [${subReportControlId}] 找不到區段: ${bandId}`);

          saveCurrentReport(currentReport);
          return {
            content: [{ type: 'text', text: `已將子報表 [${subReportControlId}] 的區段 ${bandId} 高度設定為 ${height} pt。` }],
          };
        }

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
        const { bandId, controls, subReportControlId } = args as { bandId: string; controls: ControlDefinition[]; subReportControlId?: string };

        if (subReportControlId) {
          let foundSub = false;
          let foundBand = false;
          currentReport.bands.forEach((b) => {
            const subCtrl = b.controls.find((c) => c.id === subReportControlId && c.type === 'SubReport');
            if (subCtrl && subCtrl.subReportDefinition) {
              foundSub = true;
              subCtrl.subReportDefinition.bands = subCtrl.subReportDefinition.bands.map((sb) => {
                if (sb.id === bandId || sb.type === bandId) {
                  foundBand = true;
                  return { ...sb, controls };
                }
                return sb;
              });
            }
          });

          if (!foundSub) throw new Error(`找不到指定的 SubReport 控制項: ${subReportControlId}`);
          if (!foundBand) throw new Error(`在子報表 [${subReportControlId}] 找不到區段: ${bandId}`);

          saveCurrentReport(currentReport);
          return {
            content: [{ type: 'text', text: `已成功為子報表 [${subReportControlId}] 區段 ${bandId} 批次置入 ${controls.length} 個控制項。` }],
          };
        }

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
