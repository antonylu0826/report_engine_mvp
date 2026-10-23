import { z } from 'zod';
import type { ReportDefinition } from '../types/report';
import type { ReportDataSource } from '../types/datasource';
import { reportSchema, calculatedFieldSchema } from '../report/schema';
import { findSubReport, updateReportScope } from '../report/operations';
import { getSubReportRows } from '../report/subReport';
import { getFormulaCatalog } from '../formula/registry';
import { childSchema, previewFormula, validateReportFormulas } from '../formula/report';
import { groupReportRows } from '../compiler/grouping';
import { dataSourceSchema } from '../server/requestSchema';
import { formatValue } from '../compiler/formatters';
import { fail } from '../formula/types';

const contextSchema = z.object({
  report: reportSchema.optional().describe('Complete report override for read-only validation/preview; defaults to saved report.'),
  schema: dataSourceSchema.optional().describe('Caller field definitions; defaults to demo schema.'),
  data: z.array(z.record(z.string(), z.unknown())).max(10_000).optional().describe('Detail rows; defaults to demo dataset.'),
  parameters: z.record(z.string(), z.unknown()).optional().describe('Complete master parameters; defaults to demo parameters.'),
  executionTime: z.string().optional().describe('Fixed ISO datetime with offset for reproducible NOW/TODAY.'),
  timeZone: z.string().optional().describe('IANA time zone; default UTC.'),
});
const schemas = {
  get_formula_catalog: z.object({ category: z.string().optional(), name: z.string().optional() }),
  validate_report_formulas: contextSchema.extend({ execute: z.boolean().default(false) }),
  preview_formula: contextSchema.extend({
    expression: z.string().min(1).max(8192), scope: z.enum(['row', 'group', 'report']).default('report'),
    rowIndex: z.number().int().nonnegative().default(0).describe('Index within selected group.'),
    groupIndex: z.number().int().nonnegative().default(0), subReportControlId: z.string().optional(),
    parentRowIndex: z.number().int().nonnegative().default(0), formatString: z.string().optional(),
  }),
  set_calculated_fields: z.object({ subReportControlId: z.string().optional(), calculatedFields: z.array(calculatedFieldSchema).max(256) }),
};
const descriptions: Record<keyof typeof schemas, string> = {
  get_formula_catalog: 'Discover all executable built-in formulas: syntax, signatures, types, scopes, null/date/precision rules, examples and system variables. Shared with the designer and PDF engine.',
  validate_report_formulas: 'Validate formulas, named calculations, dependency cycles, types and scopes; optionally execute against data. Returns structured diagnostics and dependency order without writing.',
  preview_formula: 'Evaluate one formula in report/group/row or child scope without modifying the template. Returns raw value, exact decimal, type and optional formatted text.',
  set_calculated_fields: 'Atomically replace the calculation collection of the main or selected child report. Static validation checks all dependencies and bindings before saving; failures preserve the original template.',
};
export const formulaTools = Object.entries(schemas).map(([name, schema]) => ({
  name, description: descriptions[name as keyof typeof schemas],
  inputSchema: z.toJSONSchema(schema, { io: 'input', reused: 'ref' }) as { type: 'object'; properties?: Record<string, unknown> },
}));
export function handleFormulaTool(name: string, args: unknown, report: ReportDefinition, source: ReportDataSource, save: (report: ReportDefinition) => unknown): unknown {
  if (name === 'get_formula_catalog') return getFormulaCatalog(schemas.get_formula_catalog.parse(args ?? {}));
  if (name === 'set_calculated_fields') {
    const input = schemas.set_calculated_fields.parse(args);
    const next = updateReportScope(report, scope => ({ ...scope, calculatedFields: input.calculatedFields }), input.subReportControlId);
    save(next);
    return { success: true, calculatedFields: input.calculatedFields };
  }
  if (name === 'validate_report_formulas') {
    const input = schemas.validate_report_formulas.parse(args ?? {});
    return validateReportFormulas(input.report ?? report, { schema: input.schema ?? source.schema, dataSource: input.data ?? source.data.items,
      reportParameters: input.parameters ?? source.data.parameters, execute: input.execute, executionTime: input.executionTime, timeZone: input.timeZone });
  }
  if (name !== 'preview_formula') return undefined;
  const input = schemas.preview_formula.parse(args);
  let definition = input.report ?? report, schema = input.schema ?? source.schema, data = input.data ?? source.data.items;
  if (input.subReportControlId) {
    const control = findSubReport(definition, input.subReportControlId);
    if (!control?.subReportDefinition) fail('UNKNOWN_FIELD', 'Subreport not found');
    if (!data[input.parentRowIndex]) fail('INVALID_SCOPE', 'Selected parent row does not exist');
    data = getSubReportRows(control, { currentRow: data[input.parentRowIndex] });
    schema = childSchema(control, schema)!;
    definition = control.subReportDefinition;
  }
  const groups = groupReportRows(definition, data);
  const groupRows = input.scope === 'report' ? undefined : groups[input.groupIndex]?.rows;
  if (input.scope !== 'report' && !groupRows) fail('INVALID_SCOPE', 'Selected group does not exist');
  const currentRow = input.scope === 'row' ? groupRows?.[input.rowIndex] : undefined;
  if (input.scope === 'row' && !currentRow) fail('INVALID_SCOPE', 'Selected row does not exist');
  const result = previewFormula(definition, input.expression, { schema, dataSource: data, reportParameters: input.parameters ?? source.data.parameters,
    groupRows, currentRow, rowIndex: input.rowIndex, scope: input.scope, executionTime: input.executionTime, timeZone: input.timeZone });
  return { ...result, ...(input.formatString ? { formatted: formatValue(result.value, input.formatString, input.timeZone) } : {}) };
}
