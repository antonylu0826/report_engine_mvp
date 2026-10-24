import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { FormulaError } from "../formula/types";
import { ReportConflictError } from "../server/reportRepository";
import type { ReportDiagnostic } from "../types/diagnostics";
export interface ReportToolOutcome {
  success: boolean;
  code: string;
  tool: string;
  version?: string;
  message?: string;
  diagnostics: ReportDiagnostic[];
  data?: unknown;
}
export function toolReply(outcome: ReportToolOutcome): CallToolResult {
  return {
    isError: !outcome.success,
    structuredContent: { ...outcome },
    content: [{ type: "text", text: JSON.stringify(outcome) }],
  };
}
/** Legacy text stays compatible; structuredContent is the uniform contract for all clients. */
export function normalizeToolReply(
  tool: string,
  result: CallToolResult,
  version?: string,
): CallToolResult {
  if (
    result.structuredContent &&
    typeof result.structuredContent.success === "boolean"
  )
    return result;
  const text = result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* Text and SVG inspection replies remain readable. */
  }
  const validation =
    data &&
    typeof data === "object" &&
    "valid" in data &&
    typeof data.valid === "boolean"
      ? (data as { valid: boolean; diagnostics?: ReportDiagnostic[] })
      : undefined;
  const success = !result.isError && validation?.valid !== false;
  const diagnostics =
    validation?.diagnostics?.map((d) => ({
      ...d,
      severity: d.severity ?? "error",
      category: d.category ?? "formula",
    })) ?? [];
  return {
    ...result,
    isError: !success,
    structuredContent: {
      success,
      code: !success ? (validation ? "VALIDATION_FAILED" : "TOOL_ERROR") : "OK",
      tool,
      version,
      diagnostics,
      data,
    },
  };
}
export function toolFailure(
  tool: string,
  error: unknown,
  version?: string,
): CallToolResult {
  const diagnostics: ReportDiagnostic[] =
    error instanceof FormulaError
      ? error.diagnostics.map((d) => ({
          ...d,
          severity: (d as ReportDiagnostic).severity ?? "error",
          category: (d as ReportDiagnostic).category ?? "formula",
        }))
      : error instanceof ZodError
        ? error.issues.map((issue) => ({
            code: "INVALID_ARGUMENT",
            severity: "error",
            category: "structure",
            message: issue.message,
            path: issue.path.join("."),
          }))
        : [];
  const code =
    error instanceof ReportConflictError
      ? "VERSION_CONFLICT"
      : error instanceof FormulaError
        ? "VALIDATION_FAILED"
        : error instanceof ZodError
          ? "INVALID_ARGUMENT"
          : (error as NodeJS.ErrnoException)?.code
            ? "STORAGE_ERROR"
            : "INVALID_ARGUMENT";
  return toolReply({
    success: false,
    code,
    tool,
    version,
    message: error instanceof Error ? error.message : String(error),
    diagnostics,
    data: { applied: false },
  });
}
