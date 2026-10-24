import type { ControlDefinition } from "../types/report";
import type { DataSourceSchema } from "../types/datasource";
import { schemaField } from "../data/schemaField";
export function childSchema(
  control: ControlDefinition,
  schema?: DataSourceSchema,
): DataSourceSchema | undefined {
  if (!schema) return undefined;
  return {
    parameters: schema.parameters,
    detailFields:
      schemaField(schema.detailFields, control.subReportBinding || "serials")
        ?.children ?? [],
  };
}
