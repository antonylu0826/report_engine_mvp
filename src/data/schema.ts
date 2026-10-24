import { z } from "zod";
import { getNestedValue } from "../report/dataPath";
import type { DataFieldSchema, ReportDataSource } from "../types/datasource.ts";

export const dataFieldSchema: z.ZodType<DataFieldSchema> = z.strictObject({
  name: z.string().min(1).max(200),
  label: z.string(),
  type: z.enum(["string", "number", "boolean", "date", "datetime", "array"]),
  nullable: z.boolean().optional(),
  formatHint: z.string().optional(),
  description: z.string().optional(),
  children: z.array(z.lazy(() => dataFieldSchema)).optional(),
});
const fields = z.array(dataFieldSchema).superRefine((values, context) => {
  const names = new Set<string>();
  values.forEach((field, i) => {
    if (names.has(field.name))
      context.addIssue({
        code: "custom",
        path: [i, "name"],
        message: "Field names must be unique within a scope",
      });
    names.add(field.name);
  });
});
export const dataSourceSchema = z.strictObject({
  parameters: fields.optional(),
  detailFields: fields,
});
export const reportDataSourceSchema: z.ZodType<ReportDataSource> = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    schema: dataSourceSchema,
    data: z.strictObject({
      parameters: z.record(z.string(), z.json()).optional(),
      items: z.array(z.record(z.string(), z.json())).max(10_000),
    }),
  })
  .superRefine((source, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    const schema = (
      fields: DataFieldSchema[],
      path: (string | number)[],
      depth = 0,
    ) => {
      if (depth > 16) {
        issue(path, "Schema nesting exceeds 16");
        return;
      }
      const names = new Set<string>();
      fields.forEach((field, i) => {
        if (names.has(field.name))
          issue(
            [...path, i, "name"],
            "Field names must be unique within a scope",
          );
        names.add(field.name);
        if (field.children)
          schema(field.children, [...path, i, "children"], depth + 1);
      });
    };
    const values = (
      fields: DataFieldSchema[],
      row: Record<string, unknown>,
      path: (string | number)[],
      depth = 0,
    ) => {
      if (depth > 16) return;
      for (const field of fields) {
        const value = getNestedValue(row, field.name),
          location = [...path, field.name];
        if (value === undefined || value === null) {
          if (field.nullable === false)
            issue(location, "Required value is missing");
          continue;
        }
        if (field.type === "array") {
          if (
            !Array.isArray(value) ||
            value.some(
              (item) =>
                !item || typeof item !== "object" || Array.isArray(item),
            )
          ) {
            issue(location, "Expected an array of JSON row objects");
            continue;
          }
          if (field.children)
            value.forEach((item, i) =>
              values(field.children!, item, [...location, i], depth + 1),
            );
        } else if (field.type === "date" || field.type === "datetime") {
          const date = typeof value === "string" ? value : "";
          const pattern =
            field.type === "date"
              ? /^\d{4}-\d{2}-\d{2}$/
              : /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i;
          const year = Number(date.slice(0, 4)),
            month = Number(date.slice(5, 7)),
            day = Number(date.slice(8, 10));
          const days = [
            31,
            year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
          ];
          if (
            !pattern.test(date) ||
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > days[month - 1] ||
            !Number.isFinite(Date.parse(date))
          )
            issue(location, `Expected a valid ISO ${field.type}`);
        } else if (
          typeof value !== field.type ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          issue(location, `Expected ${field.type}`);
      }
    };
    schema(source.schema.parameters ?? [], ["schema", "parameters"]);
    schema(source.schema.detailFields, ["schema", "detailFields"]);
    values(source.schema.parameters ?? [], source.data.parameters ?? {}, [
      "data",
      "parameters",
    ]);
    source.data.items.forEach((row, i) =>
      values(source.schema.detailFields, row, ["data", "items", i]),
    );
  });
export const parseDataSource = (value: unknown): ReportDataSource =>
  reportDataSourceSchema.parse(value);
