import type { BandDefinition, ReportDefinition } from '../types/report.ts';
import type { EvalContext } from './evaluator.ts';
import { groupReportRows } from './grouping.ts';

export interface BandInstance {
  band: BandDefinition;
  context: EvalContext;
  key: string;
  pageBreakBefore?: boolean;
  pageBreakAfter?: boolean;
}

/** Expand grouping and detail rows identically for main and nested reports. */
export function expandDetailBands(report: ReportDefinition, context: EvalContext): BandInstance[] {
  const header = report.bands.find(b => b.type === 'GroupHeader');
  const footer = report.bands.find(b => b.type === 'GroupFooter');
  const detail = report.bands.find(b => b.type === 'Detail');
  const groups = context.reportGroups ?? groupReportRows(report, context.dataSource ?? []);
  return groups.flatMap((group, groupIndex) => {
    const groupContext: EvalContext = { ...context, groupRows: group.rows, groupKey: group.key, currentRow: group.rows[0] };
    const instances: BandInstance[] = [];
    if (header) instances.push({ band: header, context: groupContext, key: `header-${groupIndex}`,
      pageBreakBefore: groupIndex > 0 && header.pageBreakBefore });
    if (detail) group.rows.forEach((currentRow, rowIndex) => instances.push({
      band: detail, context: { ...groupContext, currentRow, rowIndex }, key: `detail-${groupIndex}-${rowIndex}`,
      pageBreakBefore: detail.pageBreakBefore,
    }));
    if (footer) instances.push({ band: footer, context: groupContext, key: `footer-${groupIndex}`,
      pageBreakBefore: footer.pageBreakBefore });
    if (instances.length && groupIndex < groups.length - 1 && (header?.pageBreakAfter || footer?.pageBreakAfter)) {
      instances[instances.length - 1].pageBreakAfter = true;
    }
    return instances;
  });
}
