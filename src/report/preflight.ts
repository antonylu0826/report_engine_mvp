import { parseReport } from "./schema";
import { reportDocumentSchema } from "./document";
import type { ReportDefinition } from "../types/report";
import type {
  ReportDiagnostic,
  ReportPreflightResult,
} from "../types/diagnostics";
import type { FormulaContext } from "../formula/types";
import { FormulaError } from "../formula/types";
import { prepareReport, validateReportFormulas } from "../formula/report";
import { executionContext } from "../formula/engine";
import { getLayoutDiagnostics } from "./layoutDiagnostics";
import { ZodError } from "zod";
export class ReportValidationError extends FormulaError {
  readonly status = 422;
  declare readonly diagnostics: ReportDiagnostic[];
  constructor(diagnostics: ReportDiagnostic[]) {
    super(diagnostics);
    this.name = "ReportValidationError";
  }
}
function location(
  report: ReportDefinition,
  path = "",
): Partial<ReportDiagnostic> {
  let definition = report,
    rest = path.replace(/^report\./, ""),
    parents: string[] = [];
  while (true) {
    const match = /^bands\[(\d+)\](?:\.controls\[(\d+)\])?/.exec(rest);
    if (!match) return { subReportControlPath: parents };
    const band = Array.isArray(definition.bands)
        ? definition.bands[Number(match[1])]
        : undefined,
      control = Array.isArray(band?.controls)
        ? band.controls[Number(match[2])]
        : undefined;
    const tail = rest.slice(match[0].length);
    if (
      tail.startsWith(".subReportDefinition.") &&
      control?.subReportDefinition
    ) {
      parents = [...parents, control.id];
      definition = control.subReportDefinition;
      rest = tail.slice(".subReportDefinition.".length);
      continue;
    }
    return {
      bandId: band?.id,
      controlId: control?.id,
      subReportControlPath: parents,
    };
  }
}
function structural(
  error: ZodError,
  report?: ReportDefinition,
): ReportDiagnostic[] {
  return error.issues.slice(0, 200).map((issue) => {
    const path = issue.path
      .map((value, index) =>
        typeof value === "number"
          ? `[${value}]`
          : `${index ? "." : ""}${String(value)}`,
      )
      .join("");
    return {
      code: "INVALID_STRUCTURE",
      severity: "error",
      category: issue.path[0] === "dataSource" ? "data" : "structure",
      message: issue.message,
      path,
      ...(report ? location(report, path) : {}),
    };
  });
}
function summarize(
  diagnostics: ReportDiagnostic[],
  context?: FormulaContext,
): ReportPreflightResult {
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  return {
    valid: errorCount === 0,
    diagnostics,
    errorCount,
    warningCount: diagnostics.length - errorCount,
    executionTime: context?.executionTime,
    timeZone: context?.timeZone,
  };
}
export function prepareReportForPrint(
  report: ReportDefinition,
  options: FormulaContext & { execute?: boolean } = {},
) {
  try {
    parseReport(report);
  } catch (error) {
    if (error instanceof ZodError)
      return {
        result: summarize(structural(error, report)),
        context: undefined,
      };
    throw error;
  }
  const diagnostics = getLayoutDiagnostics(report);
  const staticResult = validateReportFormulas(report, {
    ...options,
    execute: false,
  });
  diagnostics.push(
    ...staticResult.diagnostics.map((d) => ({
      ...d,
      severity: "error" as const,
      category: (d.code === "UNKNOWN_FIELD"
        ? "binding"
        : "formula") as ReportDiagnostic["category"],
      ...location(report, d.path),
    })),
  );
  let context: FormulaContext | undefined;
  if (staticResult.valid && options.execute !== false) {
    try {
      context = prepareReport(report, options);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      diagnostics.push(
        ...error.diagnostics.map((d) => ({
          ...d,
          severity: "error" as const,
          category: "formula" as const,
          ...location(report, d.path),
        })),
      );
    }
  }
  if (!context && (!staticResult.valid || options.execute === false)) {
    try {
      context = executionContext(options);
    } catch (error) {
      if (error instanceof FormulaError)
        diagnostics.push(
          ...error.diagnostics.map((d) => ({
            ...d,
            severity: "error" as const,
            category: "formula" as const,
          })),
        );
      else throw error;
    }
  }
  return { result: summarize(diagnostics, context), context };
}
export function preflightReport(
  report: ReportDefinition,
  options: FormulaContext & { execute?: boolean } = {},
): ReportPreflightResult {
  return prepareReportForPrint(report, options).result;
}
export function preflightDocument(
  value: unknown,
  options: Pick<FormulaContext, "executionTime" | "timeZone"> & {
    execute?: boolean;
  } = {},
): ReportPreflightResult {
  const parsed = reportDocumentSchema.safeParse(value);
  if (!parsed.success) {
    const report = (value as { report?: ReportDefinition })?.report;
    return summarize(
      structural(parsed.error, report?.bands ? report : undefined),
    );
  }
  const { report, dataSource } = parsed.data;
  return preflightReport(report, {
    ...options,
    schema: dataSource.schema,
    dataSource: dataSource.data.items,
    reportParameters: dataSource.data.parameters,
  });
}
