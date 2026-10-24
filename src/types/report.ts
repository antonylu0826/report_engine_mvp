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
  borderRadius?: number;
}

/** Conditional rules intentionally exclude geometry and resource URLs. Later matching rules win. */
export type ConditionalControlStyle = Pick<ControlStyle, 'color' | 'backgroundColor' | 'fontWeight' | 'textAlign' | 'borderColor'>;
export interface ConditionalStyleRule { when: string; style: ConditionalControlStyle }

export type ControlType =
  | 'Label'
  | 'Field'
  | 'Expression'
  | 'Line'
  | 'Image'
  | 'Barcode'
  | 'QRCode'
  | 'CheckBox'
  | 'Panel'
  | 'SubReport';

export interface ControlDefinition {
  id: string;
  type: ControlType;
  x: number; // pt offset from Band left margin
  y: number; // pt offset from Band top edge
  width: number; // pt
  height: number; // pt
  style?: ControlStyle;
  /** Grow text vertically and push following rows down; may continue on another page. */
  canGrow?: boolean;
  visibleWhen?: string;
  styleRules?: ConditionalStyleRule[];

  // Specific content and data binding properties
  text?: string;            // Static text for Label, Barcode, QRCode
  fieldName?: string;       // Data field path for Field, Barcode, QRCode, CheckBox (e.g. "code", "sku", "isDelivered")
  expression?: string;      // Calculation formula (e.g. "=SUM(amount)", "=PAGE_NUMBER + '/' + TOTAL_PAGES")
  formatString?: string;    // Formatting directive (e.g. "currency", "date:YYYY-MM-DD", "number:0.00")
  src?: string;             // Image source URL / base64
  objectFit?: 'contain' | 'cover' | 'fill'; // Image scaling
  lineOrientation?: 'horizontal' | 'vertical'; // For Line control

  // CheckBox specific configurations
  checked?: boolean;        // Default checked state
  checkText?: string;       // Label text next to the checkbox

  // Barcode and QRCode specific configurations
  barcodeFormat?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
  displayValue?: boolean;   // Whether to show barcode human-readable text below
  qrErrorLevel?: 'L' | 'M' | 'Q' | 'H'; // QR Code error correction level

  // SubReport configurations
  subReportTitle?: string;
  subReportBinding?: string; // Path to nested array on parent row, e.g. "serials"
  subReportDefinition?: ReportDefinition; // Inline ReportDefinition (optional)
  subReportRefId?: string; // External template reference ID (optional)
}

export interface BandDefinition {
  id: string;
  type: BandType;
  height: number; // pt
  keepTogether?: boolean; // Fixed bands: default true; false allows breaks between complete rows. Growing bands always flow.
  visibleWhen?: string;
  controls: ControlDefinition[];

  // Grouping properties (for GroupHeader / GroupFooter)
  groupBy?: string;           // Field to group by (e.g. "category", "customerName")
  groupSortOrder?: 'asc' | 'desc'; // Sort order for groups
  pageBreakBefore?: boolean;  // Insert page break before this group
  pageBreakAfter?: boolean;   // Insert page break after this group
}

export interface ReportDefinition {
  id: string;
  name: string;
  pageSettings: PageSettings;
  bands: BandDefinition[];
  calculatedFields?: CalculatedField[];
}

export interface CalculatedField {
  name: string;
  scope: 'row' | 'group' | 'report';
  type: 'number' | 'string' | 'boolean' | 'date' | 'datetime';
  expression: string;
}

/**
 * Page dimension presets in points (pt)
 * 1 inch = 72 pt = 25.4 mm
 */
export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612.0, height: 792.0 },
};
