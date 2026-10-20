/**
 * Report Schema Definition
 * Represents the structure of a banded report document.
 */

export type PageSize = 'A4' | 'Letter';
export type PageOrientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSettings {
  size: PageSize;
  orientation: PageOrientation;
  margins: PageMargins; // Unit: pt (points, 1/72 inch)
}

export type BandType =
  | 'ReportHeader'
  | 'PageHeader'
  | 'GroupHeader'
  | 'Detail'
  | 'GroupFooter'
  | 'PageFooter'
  | 'ReportFooter';

export interface ControlStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 400 | 700;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  backgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
}

export type ControlType = 'Label' | 'Field' | 'Expression' | 'Line' | 'Image';

export interface ControlDefinition {
  id: string;
  type: ControlType;
  x: number; // pt offset from Band left margin
  y: number; // pt offset from Band top edge
  width: number; // pt
  height: number; // pt
  style?: ControlStyle;

  // Specific content and data binding properties
  text?: string;            // Static text for Label
  fieldName?: string;       // Data field path for Field (e.g. "code", "customer.name", "amount")
  expression?: string;      // Calculation formula (e.g. "=SUM(amount)", "=PAGE_NUMBER + '/' + TOTAL_PAGES")
  formatString?: string;    // Formatting directive (e.g. "currency", "date:YYYY-MM-DD", "number:0.00")
  src?: string;             // Image source URL / base64
  lineOrientation?: 'horizontal' | 'vertical'; // For Line control
}

export interface BandDefinition {
  id: string;
  type: BandType;
  height: number; // pt
  keepTogether?: boolean; // Prevent page break inside this band instance
  controls: ControlDefinition[];
}

export interface ReportDefinition {
  id: string;
  name: string;
  pageSettings: PageSettings;
  bands: BandDefinition[];
}

/**
 * Page dimension presets in points (pt)
 * 1 inch = 72 pt = 25.4 mm
 */
export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612.0, height: 792.0 },
};
