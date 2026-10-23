import { z } from 'zod';
import type { ReportDefinition, ControlDefinition } from '../types/report.ts';
import { getPageGeometry } from './geometry.ts';

const dimension = z.number().finite().nonnegative();
const id = z.string().trim().min(1);
const styleSchema = z.strictObject({
  fontFamily: z.string().optional(),
  fontSize: z.number().finite().positive().optional(),
  fontWeight: z.union([z.enum(['normal', 'bold']), z.literal(400), z.literal(700)]).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  borderWidth: dimension.optional(),
  borderTopWidth: dimension.optional(),
  borderBottomWidth: dimension.optional(),
  borderLeftWidth: dimension.optional(),
  borderRightWidth: dimension.optional(),
  padding: dimension.optional(),
  paddingHorizontal: dimension.optional(),
  paddingVertical: dimension.optional(),
  borderRadius: dimension.optional(),
});

export const controlSchema: z.ZodType<ControlDefinition> = z.strictObject({
  id,
  type: z.enum(['Label', 'Field', 'Expression', 'Line', 'Image', 'Barcode', 'QRCode', 'CheckBox', 'Panel', 'SubReport']),
  x: dimension, y: dimension, width: dimension, height: dimension,
  style: styleSchema.optional(),
  text: z.string().optional(),
  fieldName: z.string().optional(),
  expression: z.string().optional(),
  formatString: z.string().optional(),
  src: z.string().optional(),
  objectFit: z.enum(['contain', 'cover', 'fill']).optional(),
  lineOrientation: z.enum(['horizontal', 'vertical']).optional(),
  checked: z.boolean().optional(),
  checkText: z.string().optional(),
  barcodeFormat: z.enum(['CODE128', 'EAN13', 'UPC', 'CODE39']).optional(),
  displayValue: z.boolean().optional(),
  qrErrorLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
  subReportTitle: z.string().optional(),
  subReportBinding: z.string().optional(),
  subReportRefId: z.string().optional(),
  subReportDefinition: z.lazy(() => reportSchema).optional(),
});

export const reportSchema: z.ZodType<ReportDefinition> = z.strictObject({
  id,
  name: z.string(),
  pageSettings: z.strictObject({
    size: z.enum(['A4', 'Letter']),
    orientation: z.enum(['portrait', 'landscape']),
    margins: z.strictObject({ top: dimension, right: dimension, bottom: dimension, left: dimension }),
  }).refine(settings => {
    const { printableWidth, printableHeight } = getPageGeometry(settings);
    return printableWidth > 0 && printableHeight > 0;
  }, 'Page margins must leave a positive printable area'),
  bands: z.array(z.strictObject({
    id,
    type: z.enum(['ReportHeader', 'PageHeader', 'GroupHeader', 'Detail', 'GroupFooter', 'PageFooter', 'ReportFooter']),
    height: dimension,
    keepTogether: z.boolean().optional(),
    controls: z.array(controlSchema),
    groupBy: z.string().optional(),
    groupSortOrder: z.enum(['asc', 'desc']).optional(),
    pageBreakBefore: z.boolean().optional(),
    pageBreakAfter: z.boolean().optional(),
  })),
}).superRefine((report, ctx) => {
  const bandIds = new Set<string>();
  const bandTypes = new Set<string>();
  const controlIds = new Set<string>();
  report.bands.forEach((band, bi) => {
    if (bandIds.has(band.id) || bandTypes.has(band.type)) {
      ctx.addIssue({ code: 'custom', path: ['bands', bi], message: 'Band IDs and types must be unique within a report' });
    }
    bandIds.add(band.id);
    bandTypes.add(band.type);
    band.controls.forEach((control, ci) => {
      if (controlIds.has(control.id)) {
        ctx.addIssue({ code: 'custom', path: ['bands', bi, 'controls', ci, 'id'], message: 'Control IDs must be unique within a report' });
      }
      controlIds.add(control.id);
    });
  });
});

export function parseReport(value: unknown): ReportDefinition {
  return reportSchema.parse(value);
}
