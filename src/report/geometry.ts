import { PAGE_SIZES, type PageSettings, type ControlDefinition } from '../types/report.ts';

export const CSS_PIXELS_PER_POINT = 96 / 72;
export const SUBREPORT_INDENT = 35;

export function getPageGeometry(settings: PageSettings) {
  const size = PAGE_SIZES[settings.size];
  const landscape = settings.orientation === 'landscape';
  const width = landscape ? size.height : size.width;
  const height = landscape ? size.width : size.height;
  return {
    width,
    height,
    printableWidth: width - settings.margins.left - settings.margins.right,
    printableHeight: height - settings.margins.top - settings.margins.bottom,
  };
}

// Keep the existing hierarchical inset while respecting the control's own bounds.
export function getSubReportGeometry(control: ControlDefinition) {
  const indent = Math.min(SUBREPORT_INDENT, control.width);
  return { indent, width: Math.max(0, control.width - indent) };
}
