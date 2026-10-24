import { z } from "zod";
import { reportSchema } from "./schema.ts";
import { reportDataSourceSchema } from "../data/schema.ts";
import type { ReportDocument } from "../types/document.ts";

export const reportDocumentSchema = z.strictObject({
  formatVersion: z.literal(1),
  report: reportSchema,
  dataSource: reportDataSourceSchema,
});
export function parseReportDocument(value: unknown): ReportDocument {
  return reportDocumentSchema.parse(value);
}
