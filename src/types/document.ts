import type { ReportDefinition } from "./report.ts";
import type { ReportDataSource } from "./datasource.ts";

export interface ReportDocument {
  formatVersion: 1;
  report: ReportDefinition;
  dataSource: ReportDataSource;
}
export interface ReportDocumentSnapshot extends ReportDocument {
  version: string;
  mtime: number;
  legacy: boolean;
}
/** Hosts can implement this interface using their own storage; versions protect the complete document. */
export interface ReportDocumentRepository {
  read(): ReportDocumentSnapshot | Promise<ReportDocumentSnapshot>;
  write(
    value: ReportDocument,
    expectedVersion?: string,
  ): ReportDocumentSnapshot | Promise<ReportDocumentSnapshot>;
}
