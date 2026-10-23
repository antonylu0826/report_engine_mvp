import type { Plugin } from 'vite';
import { ZodError } from 'zod';
import { createReportRepository, ReportConflictError } from './reportRepository.ts';

export function reportLayoutPlugin(filePath: string): Plugin {
  const repository = createReportRepository(filePath);
  return {
    name: 'report-layout-sync',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/report-layout') return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        try {
          if (req.method === 'GET') {
            res.end(JSON.stringify(repository.read()));
          } else if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              const buffer = Buffer.from(chunk);
              size += buffer.length;
              if (size > 20 * 1024 * 1024) {
                res.statusCode = 413;
                res.end(JSON.stringify({ error: 'Report exceeds 20 MB' }));
                return;
              }
              chunks.push(buffer);
            }
            const expectedVersion = req.headers['if-match'];
            const saved = repository.write(JSON.parse(Buffer.concat(chunks).toString('utf8')),
              typeof expectedVersion === 'string' ? expectedVersion : undefined);
            res.end(JSON.stringify({ success: true, mtime: saved.mtime, version: saved.version }));
          } else {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET, POST');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
        } catch (error) {
          res.statusCode = error instanceof ReportConflictError ? 409
            : error instanceof SyntaxError || error instanceof ZodError ? 400
            : (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 500;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  };
}
