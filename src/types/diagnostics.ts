export interface ReportDiagnostic {
  code: string;
  severity: "error" | "warning";
  category:
    "structure" | "data" | "formula" | "binding" | "layout" | "pagination";
  message: string;
  path?: string;
  bandId?: string;
  controlId?: string;
  relatedControlId?: string;
  subReportControlPath?: string[];
  fieldName?: string;
  rowIndex?: number;
  groupKey?: unknown;
  span?: { start: number; end: number };
  dependencyPath?: string[];
}
export interface ReportPreflightResult {
  valid: boolean;
  diagnostics: ReportDiagnostic[];
  errorCount: number;
  warningCount: number;
  executionTime?: string;
  timeZone?: string;
}
