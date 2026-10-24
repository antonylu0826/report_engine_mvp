import type { DataFieldSchema } from "../types/datasource";
export function schemaField(
  fields: DataFieldSchema[] | undefined,
  path: string,
): DataFieldSchema | undefined {
  const direct = fields?.find((f) => f.name === path);
  if (direct) return direct;
  const [head, ...tail] = path.split(".");
  const field = fields?.find((f) => f.name === head);
  return tail.length ? schemaField(field?.children, tail.join(".")) : field;
}
