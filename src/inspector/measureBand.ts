import {
  bandIsVisible,
  resolveControlAppearance,
} from "../formula/presentation";
import type { BandDefinition } from "../types/report";
import type { EvalContext } from "../compiler/evaluator";
import { getSubReportRows, getSubReportBands } from "../report/subReport";
export function measureBandHeight(
  band: BandDefinition,
  context: EvalContext,
): number {
  if (!bandIsVisible(band, context)) return 0;
  return band.controls.reduce((height, original) => {
    const control = resolveControlAppearance(original, context);
    if (!control) return height;
    if (control.type !== "SubReport") return height;
    const rows = getSubReportRows(control, context);
    if (rows.length === 0 || !control.subReportDefinition) return height;
    const contentHeight = getSubReportBands(control, context).reduce(
      (sum, instance) =>
        sum + measureBandHeight(instance.band, instance.context),
      0,
    );
    return Math.max(height, control.y + contentHeight + 7);
  }, band.height);
}
