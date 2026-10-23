import { z } from 'zod';
import type { DataFieldSchema } from '../types/datasource.ts';
import { reportSchema } from '../report/schema.ts';

export const dataFieldSchema: z.ZodType<DataFieldSchema> = z.strictObject({
  name: z.string().min(1), label: z.string(), type: z.enum(['string', 'number', 'boolean', 'date', 'datetime', 'array']),
  nullable: z.boolean().optional(), formatHint: z.string().optional(), description: z.string().optional(),
  children: z.array(z.lazy(() => dataFieldSchema)).optional(),
});
export const dataSourceSchema = z.strictObject({
  parameters: z.array(dataFieldSchema).optional(), detailFields: z.array(dataFieldSchema),
});
export const renderRequestSchema = z.strictObject({
  report: reportSchema,
  data: z.array(z.record(z.string(), z.unknown())).max(10_000).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  dataSource: z.strictObject({ id: z.string(), name: z.string(), schema: dataSourceSchema,
    data: z.strictObject({ parameters: z.record(z.string(), z.unknown()).optional(), items: z.array(z.record(z.string(), z.unknown())).max(10_000) }),
  }).optional(),
  executionTime: z.string().optional(), timeZone: z.string().optional(),
});
