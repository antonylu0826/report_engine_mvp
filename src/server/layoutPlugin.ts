import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError } from 'zod';
import { createReportRepository, ReportConflictError } from './reportRepository.ts';
import { handleReportApi, readJsonBody } from './reportApi.ts';
import { FormulaError } from '../formula/types.ts';
import { sampleOrderDataSource, sampleOrderReport } from '../mock/sampleReport.ts';

type MiddlewareServer = { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => unknown } };

export function reportLayoutPlugin(filePath: string): Plugin {
  const repository = createReportRepository(filePath, sampleOrderDataSource.schema);
  const install = (server: MiddlewareServer) => {
    repository.initialize(sampleOrderReport);
    server.middlewares.use(async (req, res, next) => {
      if (await handleReportApi(req, res)) return;
      if (req.url?.split('?')[0] !== '/api/report-layout') return next();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      try {
        if (req.method === 'GET') {
          res.end(JSON.stringify(repository.read()));
        } else if (req.method === 'POST') {
          const body = await readJsonBody(req);
          const expectedVersion = req.headers['if-match'];
          const saved = repository.write(body, typeof expectedVersion === 'string' ? expectedVersion : undefined);
          res.end(JSON.stringify({ success: true, mtime: saved.mtime, version: saved.version }));
        } else {
          res.statusCode = 405;
          res.setHeader('Allow', 'GET, POST');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      } catch (error) {
        res.statusCode = error instanceof ReportConflictError ? 409 : error instanceof FormulaError ? 422
          : error instanceof SyntaxError || error instanceof ZodError ? 400
          : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : (error as { status?: number }).status ?? 500;
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error), ...(error instanceof FormulaError ? { diagnostics: error.diagnostics } : {}) }));
      }
    });
  };
  return { name: 'report-layout-sync', configureServer: install, configurePreviewServer: install };
}
