import type { ReportDefinition } from './report';
import type { ReportDataSource } from './datasource';

export interface PDFCompilerProps {
  report: ReportDefinition;
  data?: Record<string, unknown>[];
  parameters?: Record<string, unknown>;
  dataSource?: ReportDataSource;
  executionTime?: string;
  timeZone?: string;
}
