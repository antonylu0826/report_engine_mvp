import { parseReportDocument } from "./document";
import { assertReportFormulas } from "../formula/report";
export function validateReportDocument(value: unknown) {
  const document = parseReportDocument(value);
  assertReportFormulas(document.report, document.dataSource.schema);
  return document;
}
