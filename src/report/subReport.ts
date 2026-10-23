import type { BandDefinition, ControlDefinition } from '../types/report';
import { getNestedValue, type EvalContext } from '../compiler/evaluator';
import { expandDetailBands, type BandInstance } from '../compiler/bandPipeline';

export function getSubReportRows(control: ControlDefinition, context: EvalContext): Record<string, unknown>[] {
  const value = getNestedValue(context.currentRow, control.subReportBinding || 'serials');
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> =>
    row !== null && typeof row === 'object' && !Array.isArray(row)) : [];
}

export function getSubReportContext(control: ControlDefinition, context: EvalContext): EvalContext {
  const rows = getSubReportRows(control, context);
  return { ...context, currentRow: rows[0], dataSource: rows, groupRows: rows, rowIndex: 0 };
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

export function measureBandHeight(band: BandDefinition, context: EvalContext): number {
  return band.controls.reduce((height, control) => {
    if (control.type !== 'SubReport') return height;
    const rows = getSubReportRows(control, context);
    if (rows.length === 0 || !control.subReportDefinition) return height;
    const contentHeight = getSubReportBands(control, context).reduce((sum, instance) =>
      sum + measureBandHeight(instance.band, instance.context), 0);
    return Math.max(height, control.y + contentHeight + 7);
  }, band.height);
}
