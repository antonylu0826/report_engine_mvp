import { z } from "zod";
import { reportSchema } from "../report/schema.ts";
import { reportDataSourceSchema } from "../data/schema.ts";
export {
  dataFieldSchema,
  dataSourceSchema,
  reportDataSourceSchema,
} from "../data/schema.ts";

export const renderRequestSchema = z.strictObject({
  report: reportSchema,
  data: z.array(z.record(z.string(), z.unknown())).max(10_000).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  dataSource: reportDataSourceSchema.optional(),
  executionTime: z.string().optional(),
  timeZone: z.string().optional(),
});

// Keep document values unparsed so the shared preflight returns structural/data diagnostics too.
export const preflightRequestSchema = z.strictObject({
  formatVersion: z.unknown(),
  report: z.unknown(),
  dataSource: z.unknown(),
  executionTime: z.string().optional(),
  timeZone: z.string().optional(),
  execute: z.boolean().optional(),
});
