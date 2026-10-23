import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { FormulaError } from '../formula/types.ts';
import { getFormulaCatalog } from '../formula/registry.ts';
import { validateReportFormulas } from '../formula/report.ts';
import { renderRequestSchema } from './requestSchema.ts';
import { renderReportPdf } from './pdfService.ts';

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 20 * 1024 * 1024) throw Object.assign(new Error('Request exceeds 20 MB'), { status: 413 });
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function respondError(response: ServerResponse, error: unknown) {
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = error instanceof FormulaError ? 422 : error instanceof SyntaxError || error instanceof ZodError ? 400
    : (error as { status?: number }).status ?? 500;
  response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error), ...(error instanceof FormulaError ? { diagnostics: error.diagnostics } : {}) }));
}
export async function handleReportApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (!['/api/report-pdf', '/api/formula-catalog', '/api/validate-report-formulas'].includes(url.pathname)) return false;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');
  try {
    if (url.pathname === '/api/formula-catalog' && request.method === 'GET') {
      response.end(JSON.stringify(getFormulaCatalog({ category: url.searchParams.get('category') ?? undefined, name: url.searchParams.get('name') ?? undefined })));
    } else if (url.pathname !== '/api/formula-catalog' && request.method === 'POST') {
      const input = renderRequestSchema.parse(await readJsonBody(request));
      if (url.pathname === '/api/validate-report-formulas') {
        response.end(JSON.stringify(validateReportFormulas(input.report, {
          schema: input.dataSource?.schema, dataSource: input.data ?? input.dataSource?.data.items,
          reportParameters: { ...input.dataSource?.data.parameters, ...input.parameters }, executionTime: input.executionTime, timeZone: input.timeZone, execute: true,
        })));
      } else {
        const pdf = await renderReportPdf(input);
        response.setHeader('Content-Type', 'application/pdf');
        response.setHeader('Content-Length', pdf.byteLength);
        response.setHeader('Content-Disposition', 'inline; filename="report.pdf"');
        response.end(pdf);
      }
    } else {
      response.statusCode = 405;
      response.setHeader('Allow', url.pathname === '/api/formula-catalog' ? 'GET' : 'POST');
      response.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  } catch (error) { respondError(response, error); }
  return true;
}
