import { measureBandHeight } from './measureBand';
import { bandIsVisible, resolveControlAppearance } from '../formula/presentation';
import type { ReportDefinition, ControlDefinition, BandDefinition } from '../types/report';
import { evaluateExpression, type EvalContext } from '../compiler/evaluator';
import { prepareReport } from '../formula/report';
import { formatValue } from '../compiler/formatters';
import { expandDetailBands } from '../compiler/bandPipeline';
import { getPageGeometry, getSubReportGeometry } from '../report/geometry';
import { getSubReportBands } from '../report/subReport';

export interface LayoutDiagnostic {
  bandId: string;
  bandType: string;
  controlId?: string;
  severity: 'error' | 'warning' | 'info';
  category: 'overflow' | 'collision' | 'alignment' | 'budget';
  message: string;
}
export interface LayoutInspectionReport {
  pageSize: string;
  printableWidth: number;
  totalBands: number;
  totalControls: number;
  diagnostics: LayoutDiagnostic[];
  asciiWireframe: string;
  isValid: boolean;
}

const isContent = (control: ControlDefinition) => control.type !== 'Line' && control.type !== 'Panel'
  && !(control.type === 'Label' && !control.text);
const isColumn = (control: ControlDefinition) => ['Field', 'Expression', 'Barcode', 'QRCode', 'CheckBox'].includes(control.type);

export function inspectReportLayout(report: ReportDefinition): LayoutInspectionReport {
  const diagnostics: LayoutDiagnostic[] = [];
  const { printableWidth, printableHeight } = getPageGeometry(report.pageSettings);
  let totalControls = 0;
  let totalBands = 0;
  const wireframe: string[] = [];
  const inspect = (scope: ReportDefinition, availableWidth: number, prefix = '') => {
    for (const band of scope.bands) {
      totalBands++;
      totalControls += band.controls.length;
      const bandType = prefix + band.type;
      wireframe.push(bandType + ' | height: ' + band.height + ' pt | controls: ' + band.controls.length);
      for (const control of band.controls) {
        if (control.x < 0 || control.y < 0 || control.width < 0 || control.height < 0
          || ![control.x, control.y, control.width, control.height].every(Number.isFinite)
          || control.x + control.width > availableWidth + 0.5) {
          diagnostics.push({ bandId: band.id, bandType, controlId: control.id, severity: 'error', category: 'overflow',
            message: control.id + ': invalid geometry or exceeds available width ' + availableWidth.toFixed(1) + ' pt' });
        }
        if (control.y + control.height > band.height + 0.5 && control.type !== 'SubReport') {
          diagnostics.push({ bandId: band.id, bandType, controlId: control.id, severity: 'warning', category: 'overflow',
            message: control.id + ': exceeds band height ' + band.height + ' pt' });
        }
        if (control.type === 'SubReport' && control.subReportDefinition) {
          inspect(control.subReportDefinition, getSubReportGeometry(control).width, prefix + control.id + '/');
        }
      }
      const content = band.controls.filter(isContent);
      for (let i = 0; i < content.length; i++) {
        for (let j = i + 1; j < content.length; j++) {
          const a = content[i], b = content[j];
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapX > 2 && overlapY > 2) diagnostics.push({ bandId: band.id, bandType,
            controlId: a.id + ' <-> ' + b.id, severity: 'warning', category: 'collision',
            message: a.id + ' overlaps ' + b.id + ' (' + overlapX.toFixed(1) + ' × ' + overlapY.toFixed(1) + ' pt)' });
        }
      }
    }
    const header = scope.bands.find(b => b.type === 'PageHeader')
      ?? (prefix ? scope.bands.find(b => b.type === 'ReportHeader') : undefined);
    const detail = scope.bands.find(b => b.type === 'Detail');
    if (!header || !detail) return;
    const columns = header.controls.filter(c => c.type === 'Label' && c.text).sort((a, b) => a.x - b.x);
    const fields = detail.controls.filter(isColumn).sort((a, b) => a.x - b.x);
    if (columns.length === 0 && fields.length === 0) return;
    if (columns.length !== fields.length) {
      diagnostics.push({ bandId: header.id, bandType: prefix + header.type, severity: 'warning', category: 'alignment',
        message: 'Header/detail column counts differ: ' + columns.length + '/' + fields.length });
    } else columns.forEach((column, index) => {
      const field = fields[index];
      if (Math.abs(column.x - field.x) > 1 || Math.abs(column.width - field.width) > 1) {
        diagnostics.push({ bandId: header.id, bandType: prefix + header.type,
          controlId: column.id + ' vs ' + field.id, severity: 'error', category: 'alignment',
          message: 'Column ' + (index + 1) + ' is not aligned: ' + column.id + ' vs ' + field.id });
      }
    });
  };
  inspect(report, printableWidth);
  const fixedHeight = report.bands.filter(b => b.type === 'PageHeader' || b.type === 'PageFooter')
    .reduce((sum, band) => sum + band.height, 0);
  if (printableWidth <= 0 || fixedHeight >= printableHeight) diagnostics.push({
    bandId: report.id, bandType: 'Page', severity: 'error', category: 'budget', message: 'No printable space remains for report content',
  });
  return { pageSize: report.pageSettings.size, printableWidth, totalBands, totalControls, diagnostics,
    asciiWireframe: wireframe.join('\n'), isValid: !diagnostics.some(d => d.severity === 'error') };
}

const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[character]!);

/** A bounded layout overview, not a replacement for the PDF pagination engine. */
export function renderReportToSvg(
  report: ReportDefinition, rows: Record<string, unknown>[] = [], parameters: Record<string, unknown> = {},
): string {
  const geometry = getPageGeometry(report.pageSettings);
  const margins = report.pageSettings.margins;
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + geometry.width + ' ' + geometry.height + '" width="' + geometry.width + '" height="' + geometry.height + '">',
    '<desc>Layout overview showing at most five detail rows. Use PDF output to verify pagination.</desc>',
    '<rect width="100%" height="100%" fill="white"/>',
    '<rect x="' + margins.left + '" y="' + margins.top + '" width="' + geometry.printableWidth + '" height="' + geometry.printableHeight + '" fill="none" stroke="#cbd5e1"/>',
  ];
  const globalContext: EvalContext = prepareReport(report, { dataSource: rows, reportParameters: parameters });
  const renderBand = (band: BandDefinition, x: number, y: number, context: EvalContext) => {
    if (!bandIsVisible(band,context)) return 0;
    band.controls.forEach(control => renderControl(control, x, y, context));
    return measureBandHeight(band, context);
  };
  const renderControl = (original: ControlDefinition, offsetX: number, offsetY: number, context: EvalContext) => {
    const control=resolveControlAppearance(original,context);
    if(!control)return;
    const x = offsetX + control.x, y = offsetY + control.y;
    const width = control.width, height = control.height;
    const style = control.style ?? {};
    if (control.type === 'SubReport') {
      const instances = getSubReportBands(control, context);
      if (instances.length === 0) return;
      const geometry = getSubReportGeometry(control);
      let subY = y + 2;
      for (const instance of instances) subY += renderBand(instance.band, x + geometry.indent, subY, instance.context);
      parts.push('<rect x="' + (x + geometry.indent) + '" y="' + y + '" width="' + geometry.width + '" height="' + (subY - y + 2) + '" fill="none" stroke="#0284c7" stroke-width="0.5"/>');
      return;
    }
    const stroke = escapeXml(style.borderColor ?? '#cbd5e1');
    parts.push('<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" fill="' + escapeXml(style.backgroundColor ?? 'none') + '" stroke="' + stroke + '" stroke-width="' + (style.borderWidth ?? 0) + '"/>');
    const edges = [
      [style.borderTopWidth, x, y, x + width, y], [style.borderBottomWidth, x, y + height, x + width, y + height],
      [style.borderLeftWidth, x, y, x, y + height], [style.borderRightWidth, x + width, y, x + width, y + height],
    ];
    for (const [weight, x1, y1, x2, y2] of edges) if (weight) parts.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="' + weight + '"/>');
    if (control.type === 'Line') {
      const vertical = control.lineOrientation === 'vertical';
      parts.push('<line x1="' + x + '" y1="' + y + '" x2="' + (vertical ? x : x + width) + '" y2="' + (vertical ? y + height : y) + '" stroke="' + escapeXml(style.color ?? '#cbd5e1') + '" stroke-width="' + (vertical ? width : height) + '"/>');
      return;
    }
    let text = control.text ?? '';
    if (control.type === 'Field' || control.type === 'Expression') text = formatValue(
      evaluateExpression(control.expression, control.type === 'Field' ? control.fieldName : undefined, context), control.formatString);
    if (control.type === 'Barcode' || control.type === 'QRCode') text = '[' + control.type + ']';
    if (control.type === 'Image') text = '[Image]';
    if (control.type === 'Panel') return;
    const fontSize = style.fontSize ?? 9;
    const align = style.textAlign ?? 'left';
    const textX = align === 'center' ? x + width / 2 : align === 'right' ? x + width - 4 : x + 4;
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    parts.push('<text x="' + textX + '" y="' + (y + height / 2 + fontSize / 3) + '" font-size="' + fontSize + '" font-weight="' + (style.fontWeight ?? 'normal') + '" fill="' + escapeXml(style.color ?? '#0f172a') + '" text-anchor="' + anchor + '">' + escapeXml(text) + '</text>');
  };
  let y = margins.top;
  const footer = report.bands.find(b => b.type === 'PageFooter');
  const bottom = geometry.height - margins.bottom - (footer?.height ?? 0);
  const leading = report.bands.filter(b => b.type === 'ReportHeader' || b.type === 'PageHeader')
    .map(band => ({ band, context: globalContext }));
  let detailRows = 0;
  const detail = expandDetailBands(report, globalContext).filter(instance => instance.band.type !== 'Detail' || detailRows++ < 5);
  const trailing = report.bands.filter(b => b.type === 'ReportFooter').map(band => ({ band, context: globalContext }));
  for (const instance of [...leading, ...detail, ...trailing]) {
    const height = measureBandHeight(instance.band, instance.context);
    if (y + height > bottom) break;
    y += renderBand(instance.band, margins.left, y, instance.context);
  }
  if (footer) renderBand(footer, margins.left, bottom, globalContext);
  parts.push('</svg>');
  return parts.join('\n');
}
