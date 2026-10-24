import { z } from "zod";
import {
  reportSchema,
  controlSchema,
  calculatedFieldSchema,
  predicateSchema,
} from "../report/schema";
import { reportDataSourceSchema } from "../data/schema";
import { parseReportDocument } from "../report/document";
import { preflightDocument } from "../report/preflight";
import {
  updateReportScope,
  updateReportBand,
  patchControl,
  deleteControl,
} from "../report/operations";
import type {
  ReportDocument,
  ReportDocumentRepository,
} from "../types/document";
import { ReportConflictError } from "../server/reportRepository";
import { toolReply } from "./results";
const scope = { subReportControlId: z.string().optional() };
const operationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("update_control"),
    ...scope,
    bandId: z.string(),
    controlId: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
  z.strictObject({
    type: z.literal("add_control"),
    ...scope,
    bandId: z.string(),
    control: controlSchema,
  }),
  z.strictObject({
    type: z.literal("delete_control"),
    ...scope,
    bandId: z.string(),
    controlId: z.string(),
  }),
  z.strictObject({
    type: z.literal("update_band"),
    ...scope,
    bandId: z.string(),
    patch: z.strictObject({
      height: z.number().finite().nonnegative().optional(),
      keepTogether: z.boolean().optional(),
      visibleWhen: predicateSchema.nullable().optional(),
      controls: z.array(controlSchema).optional(),
      groupBy: z.string().nullable().optional(),
      groupSortOrder: z.enum(["asc", "desc"]).optional(),
      pageBreakBefore: z.boolean().optional(),
      pageBreakAfter: z.boolean().optional(),
    }),
  }),
  z.strictObject({
    type: z.literal("set_calculated_fields"),
    ...scope,
    calculatedFields: z.array(calculatedFieldSchema).max(256),
  }),
]);
export const reportChangesSchema = z
  .strictObject({
    report: reportSchema.optional(),
    dataSource: reportDataSourceSchema.optional(),
    operations: z.array(operationSchema).max(200).optional(),
  })
  .refine(
    (value) => value.report || value.dataSource || value.operations?.length,
    "Provide a report, data source or nonempty operation list",
  );
export type ReportChanges = z.infer<typeof reportChangesSchema>;
export type ReportChangeOperation = z.infer<typeof operationSchema>;
const clock = {
  executionTime: z.string().optional(),
  timeZone: z.string().optional(),
};
const schemas = {
  preflight_report: z.strictObject({
    document: z.unknown().optional(),
    execute: z.boolean().default(true),
    ...clock,
  }),
  preview_report_changes: z.strictObject({
    baseVersion: z.string().optional(),
    changes: reportChangesSchema,
    ...clock,
  }),
  apply_report_changes: z.strictObject({
    baseVersion: z.string().min(1),
    changes: reportChangesSchema,
    ...clock,
  }),
};
const descriptions: Record<keyof typeof schemas, string> = {
  preflight_report:
    "Read-only print preflight: validate structure, JSON values, bindings, conditions, formulas, geometry and pagination. Diagnostics include paths and nested control locations. Defaults to the saved document.",
  preview_report_changes:
    "Preview an atomic report/data change without writing. Returns validation, current version and a bounded before/after diff. Operations apply in order after optional complete report/data overrides. Use returned version as baseVersion when applying.",
  apply_report_changes:
    "Atomically apply reviewed changes only if baseVersion still matches. Revalidates the entire candidate including runtime predicates, formulas and print layout before one repository write. Validation/conflict failures preserve the saved document.",
};
export const changeTools = Object.entries(schemas).map(([name, schema]) => ({
  name,
  description: descriptions[name as keyof typeof schemas],
  annotations: {
    readOnlyHint: name !== "apply_report_changes",
    destructiveHint: name === "apply_report_changes",
  },
  inputSchema: z.toJSONSchema(schema, { io: "input", reused: "ref" }) as {
    type: "object";
    properties?: Record<string, unknown>;
  },
}));
export function applyDocumentChanges(
  current: ReportDocument,
  changes: z.infer<typeof reportChangesSchema>,
): ReportDocument {
  let report = changes.report ?? current.report;
  for (const operation of changes.operations ?? []) {
    report = updateReportScope(
      report,
      (definition) => {
        switch (operation.type) {
          case "update_control": {
            const patch = { ...operation.patch };
            for (const key of ["visibleWhen", "styleRules"])
              if (patch[key] === null) patch[key] = undefined;
            return patchControl(
              definition,
              operation.bandId,
              operation.controlId,
              patch,
            );
          }
          case "add_control":
            return updateReportBand(definition, operation.bandId, (band) => ({
              ...band,
              controls: [...band.controls, operation.control],
            }));
          case "delete_control":
            return deleteControl(
              definition,
              operation.bandId,
              operation.controlId,
            );
          case "update_band":
            return updateReportBand(definition, operation.bandId, (band) => ({
              ...band,
              ...operation.patch,
              visibleWhen:
                operation.patch.visibleWhen === null
                  ? undefined
                  : (operation.patch.visibleWhen ?? band.visibleWhen),
              groupBy:
                operation.patch.groupBy === null
                  ? undefined
                  : (operation.patch.groupBy ?? band.groupBy),
            }));
          case "set_calculated_fields":
            return {
              ...definition,
              calculatedFields: operation.calculatedFields,
            };
        }
      },
      operation.subReportControlId,
    );
  }
  return parseReportDocument({
    formatVersion: 1,
    report,
    dataSource: changes.dataSource ?? current.dataSource,
  });
}
export function summarizeDocumentChanges(
  before: ReportDocument,
  after: ReportDocument,
) {
  const differences: { path: string; before: unknown; after: unknown }[] = [];
  let count = 0;
  const short = (value: unknown) =>
    typeof value === "string" && value.length > 500
      ? value.slice(0, 500) + "…"
      : value;
  const walk = (a: unknown, b: unknown, path: string) => {
    if (Object.is(a, b)) return;
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      Array.isArray(a) === Array.isArray(b)
    ) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys)
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          Array.isArray(a) ? `${path}[${key}]` : `${path}.${key}`,
        );
      return;
    }
    count++;
    if (differences.length < 100)
      differences.push({
        path,
        before:
          a === undefined
            ? null
            : typeof a === "object" && a
              ? `[${Array.isArray(a) ? "array" : "object"}]`
              : short(a),
        after:
          b === undefined
            ? null
            : typeof b === "object" && b
              ? `[${Array.isArray(b) ? "array" : "object"}]`
              : short(b),
      });
  };
  walk(before.report, after.report, "report");
  walk(before.dataSource, after.dataSource, "dataSource");
  return {
    changeCount: count,
    differences,
    truncated: count > differences.length,
    rowCountBefore: before.dataSource.data.items.length,
    rowCountAfter: after.dataSource.data.items.length,
  };
}
export async function handleChangeTool(
  name: string,
  args: unknown,
  repository: ReportDocumentRepository,
) {
  if (!Object.hasOwn(schemas, name)) return undefined;
  const current = await repository.read();
  if (name === "preflight_report") {
    const input = schemas.preflight_report.parse(args ?? {}),
      usesOverride = input.document !== undefined;
    const result = preflightDocument(
      usesOverride
        ? input.document
        : {
            formatVersion: 1,
            report: current.report,
            dataSource: current.dataSource,
          },
      input,
    );
    return toolReply({
      success: result.valid,
      code: result.valid ? "OK" : "VALIDATION_FAILED",
      tool: name,
      version: current.version,
      diagnostics: result.diagnostics,
      data: { ...result, usesOverride },
    });
  }
  const input = (
    name === "apply_report_changes"
      ? schemas.apply_report_changes
      : schemas.preview_report_changes
  ).parse(args);
  if (input.baseVersion !== undefined && input.baseVersion !== current.version)
    throw new ReportConflictError();
  const before: ReportDocument = {
    formatVersion: 1,
    report: current.report,
    dataSource: current.dataSource,
  };
  const next = applyDocumentChanges(before, input.changes),
    summary = summarizeDocumentChanges(before, next),
    validation = preflightDocument(next, {
      executionTime: input.executionTime,
      timeZone: input.timeZone,
    });
  if (!validation.valid)
    return toolReply({
      success: false,
      code: "VALIDATION_FAILED",
      tool: name,
      version: current.version,
      diagnostics: validation.diagnostics,
      data: { applied: false, summary, validation },
    });
  const apply = name === "apply_report_changes" && summary.changeCount > 0;
  const saved = apply ? await repository.write(next, current.version) : current;
  return toolReply({
    success: true,
    code: summary.changeCount === 0 ? "NO_CHANGES" : "OK",
    tool: name,
    version: saved.version,
    diagnostics: validation.diagnostics,
    data: { applied: apply, baseVersion: current.version, summary, validation },
  });
}
