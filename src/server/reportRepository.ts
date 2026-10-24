import { replaceFileAtomically } from './atomicFile';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { parseReport } from '../report/schema.ts';
import type { ReportDefinition } from '../types/report.ts';
import type { DataSourceSchema } from '../types/datasource.ts';
import { assertReportFormulas } from '../formula/report.ts';

export class ReportConflictError extends Error {
  constructor() { super('Report changed on disk. Reload before saving.'); }
}

export function createReportRepository(filePath: string, schema?: DataSourceSchema) {
  const versionOf = (content: string) => createHash('sha256').update(content).digest('hex');
  return {
    read() {
      const content = fs.readFileSync(filePath, 'utf8');
      const value = JSON.parse(content);
      return { report: parseReport(value.formatVersion === 1 ? value.report : value), version: versionOf(content), mtime: fs.statSync(filePath).mtimeMs };
    },
    write(value: unknown, expectedVersion?: string) {
      const report = parseReport(value);
      const existing = fs.existsSync(filePath) ? (() => { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return undefined; } })() : undefined;
      assertReportFormulas(report, existing?.formatVersion === 1 ? existing.dataSource.schema : schema);
      if (expectedVersion !== undefined) {
        const actual = fs.existsSync(filePath) ? versionOf(fs.readFileSync(filePath, 'utf8')) : '';
        if (actual !== expectedVersion) throw new ReportConflictError();
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      const content = JSON.stringify(existing?.formatVersion === 1 ? { formatVersion: 1, report, dataSource: existing.dataSource } : report, null, 2);
      try {
        fs.writeFileSync(temporaryPath, content, 'utf8');
        replaceFileAtomically(temporaryPath, filePath, { beforeReplace: () => {
          if (expectedVersion !== undefined) {
            const actual=fs.existsSync(filePath) ? versionOf(fs.readFileSync(filePath,'utf8')) : '';
            if (actual !== expectedVersion) throw new ReportConflictError();
          }
        } });
      } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
      }
      return { report, version: versionOf(content), mtime: fs.statSync(filePath).mtimeMs };
    },
    initialize(report: ReportDefinition) {
      if (!fs.existsSync(filePath)) this.write(report);
    },
  };
}
