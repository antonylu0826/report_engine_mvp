export const reportTools = [
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
              type: 'integer',
              minimum: 0,
              maximum: 10000,
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
    ];
