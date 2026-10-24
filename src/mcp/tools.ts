import { changeTools } from './changeTools';
import { formulaTools } from './formulaTools';
import { z } from 'zod';
import { reportDataSourceSchema } from '../data/schema';
import { reportSchema } from '../report/schema';
export const reportTools = [
      ...formulaTools,
      ...changeTools,
      {
        name: 'get_report_data_source',
        description: 'Read the saved data source, typed field schema, parameters, JSON rows and document version used by validation and PDF rendering.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'set_report_data_source',
        description: 'Atomically replace the data source. Supply an optional compatible report when switching schemas. Validation failures preserve the existing report and data.',
        inputSchema: z.toJSONSchema(z.object({ dataSource: reportDataSourceSchema, report: reportSchema.optional() }), { io: 'input', reused: 'ref' }) as { type: 'object'; properties?: Record<string, unknown> },
      },
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
                visibleWhen: { type: 'string', description: 'Boolean formula controlling visibility; null means hidden.' },
                styleRules: { type: 'array', items: { type: 'object', properties: { when: { type: 'string' }, style: { type: 'object' } }, required: ['when', 'style'] }, description: 'Ordered conditional styles. Query get_available_data_fields for supported properties per control.' },
                canGrow: { type: 'boolean', description: 'Grow text and move following rows down; allows long content to continue on later pages.' },
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
        description: 'Reset both report and data source to the configured initial document. This explicitly replaces saved state.',
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
              type: 'integer',
              minimum: 0,
              maximum: 10000,
              description: 'Maximum saved rows to render (default: all saved rows). Never generates mock records.',
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
    ].map(tool=>{
      const mutating=['add_control','update_control','delete_control','set_band_height','set_band_controls','batch_update_controls','update_page_settings','reset_report_layout','set_full_report','set_calculated_fields','set_report_data_source'].includes(tool.name);
      return mutating?{...tool,inputSchema:{...tool.inputSchema,properties:{...tool.inputSchema.properties,expectedVersion:{type:'string',description:'Reject this legacy mutation if the saved document changed since reading this version. Prefer preview_report_changes/apply_report_changes for atomic validated edits.'}}}}:tool;
    });
