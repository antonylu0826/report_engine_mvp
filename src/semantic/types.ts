/**
 * High-Level Semantic Report Specification (Agent-Native DSL)
 * Designed for AI Agents and high-level declarative report generation without manual coordinate calculations.
 */

import type { PageSize, PageOrientation } from '../types/report';

export type SemanticTheme = 'slate' | 'blue' | 'emerald' | 'amber' | 'purple';

export interface SemanticMetaField {
  label: string;
  value: string;
}

export interface SemanticColumn {
  id: string;
  label: string;             // Table header text (e.g. "品名規格")
  field?: string;            // Bound data field (e.g. "productName")
  expression?: string;       // Expression like "=ROW_INDEX"
  format?: string;           // "C0", "N0", "date", etc.
  widthWeight: number;       // Column width ratio (e.g. 1 for index, 3 for name, 1.5 for price)
  align?: 'left' | 'center' | 'right';
  summary?: 'SUM' | 'AVG' | 'COUNT'; // Automatically place aggregate expression in ReportFooter
}

export interface SemanticReportSpec {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  theme?: SemanticTheme;
  pageSettings?: {
    size?: PageSize;
    orientation?: PageOrientation;
    margins?: { top: number; right: number; bottom: number; left: number };
  };
  metaFields?: SemanticMetaField[];
  columns: SemanticColumn[];
  signatures?: string[];     // E.g. ["出貨倉管簽名", "客戶簽收簽章"]
}
