import type { BandDefinition, ControlDefinition, ReportDefinition } from '../types/report';

export interface SubReportPath { bandId: string; controlId: string }

export function findSubReport(report: ReportDefinition, controlId: string): ControlDefinition | undefined {
  for (const band of report.bands) {
    for (const control of band.controls) {
      if (control.id === controlId && control.type === 'SubReport') return control;
      if (control.subReportDefinition) {
        const nested = findSubReport(control.subReportDefinition, controlId);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

export function getActiveReport(report: ReportDefinition, path: SubReportPath | null): ReportDefinition {
  if (!path) return report;
  return report.bands.find(b => b.id === path.bandId)?.controls
    .find(c => c.id === path.controlId)?.subReportDefinition ?? report;
}

export function updateReportScope(
  report: ReportDefinition,
  transform: (report: ReportDefinition) => ReportDefinition,
  subReportControlId?: string,
): ReportDefinition {
  if (!subReportControlId) return transform(report);
  const target = findSubReport(report, subReportControlId);
  if (!target?.subReportDefinition) throw new Error(`SubReport not found or uninitialized: ${subReportControlId}`);
  const update = (scope: ReportDefinition): ReportDefinition => {
    let changed = false;
    const bands = scope.bands.map(band => {
      let bandChanged = false;
      const controls = band.controls.map(control => {
        const child = control === target ? transform(target.subReportDefinition!)
          : control.subReportDefinition ? update(control.subReportDefinition) : undefined;
        if (child === control.subReportDefinition) return control;
        changed = bandChanged = true;
        return { ...control, subReportDefinition: child };
      });
      return bandChanged ? { ...band, controls } : band;
    });
    return changed ? { ...scope, bands } : scope;
  };
  return update(report);
}

export function updateReportBand(
  report: ReportDefinition,
  bandId: string,
  transform: (band: BandDefinition) => BandDefinition,
): ReportDefinition {
  const target = report.bands.find(b => b.id === bandId) ?? report.bands.find(b => b.type === bandId);
  if (!target) throw new Error(`Band not found: ${bandId}`);
  return { ...report, bands: report.bands.map(b => b === target ? transform(b) : b) };
}

export function patchControl(
  report: ReportDefinition, bandId: string, controlId: string, patch: Partial<ControlDefinition>,
): ReportDefinition {
  if (patch.id !== undefined && patch.id !== controlId) throw new Error('Control IDs cannot be changed by a patch');
  return updateReportBand(report, bandId, band => {
    if (!band.controls.some(c => c.id === controlId)) throw new Error(`Control not found: ${controlId}`);
    return { ...band, controls: band.controls.map(c => c.id === controlId
      ? { ...c, ...patch, id: c.id, style: { ...c.style, ...patch.style } }
      : c) };
  });
}

export function deleteControl(report: ReportDefinition, bandId: string, controlId: string): ReportDefinition {
  return updateReportBand(report, bandId, band => {
    if (!band.controls.some(c => c.id === controlId)) throw new Error(`Control not found: ${controlId}`);
    return { ...band, controls: band.controls.filter(c => c.id !== controlId) };
  });
}
