import type { ControlDefinition } from '../types/report.ts';
import type { EvalContext } from '../compiler/evaluator.ts';
import { getNestedValue } from './dataPath.ts';
import { expandDetailBands, type BandInstance } from '../compiler/bandPipeline.ts';

export function getSubReportRows(control: ControlDefinition, context: EvalContext): Record<string, unknown>[] {
  const value = getNestedValue(context.currentRow, control.subReportBinding || 'serials');
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> =>
    row !== null && typeof row === 'object' && !Array.isArray(row)) : [];
}

export function getSubReportContext(control: ControlDefinition, context: EvalContext): EvalContext {
  if (control.subReportDefinition && context.getChildContext) return context.getChildContext(control, context);
  const rows = getSubReportRows(control, context);
  return { ...context, reportGroups: undefined, groupKey: undefined, currentRow: rows[0], dataSource: rows, groupRows: rows, rowIndex: 0 };
}

export function getSubReportBands(control: ControlDefinition, context: EvalContext): BandInstance[] {
  const definition = control.subReportDefinition;
  if (!definition || getSubReportRows(control, context).length === 0) return [];
  const childContext = getSubReportContext(control, context);
  const fixed = (types: string[]) => definition.bands.filter(band => types.includes(band.type))
    .map(band => ({ band, context: childContext, key: band.id }));
  return [
    ...fixed(['ReportHeader', 'PageHeader']),
    ...expandDetailBands(definition, childContext),
    ...fixed(['ReportFooter', 'PageFooter']),
  ];
}
