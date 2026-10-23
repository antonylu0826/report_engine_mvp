import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { preview } from 'vite';
import { temporaryDirectory, reportFixture } from './helpers';

test('the configured Vite loader serves backend PDFs and persists layouts in production preview', async () => {
  const temporary = temporaryDirectory();
  const previousLayout = process.env.REPORT_ENGINE_LAYOUT_FILE;
  process.env.REPORT_ENGINE_LAYOUT_FILE = path.join(temporary.directory, 'layout.json');
  let server: Awaited<ReturnType<typeof preview>> | undefined;
  try {
    server = await preview({ configLoader: 'runner', logLevel: 'silent', build: { outDir: temporary.directory }, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const layout = await (await fetch(origin + '/api/report-layout')).json();
    assert.ok(layout.report.calculatedFields.length > 0, 'Fresh demo storage initializes with the current sample');
    const pdf = await fetch(origin + '/api/report-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: reportFixture(), data: [{}] }) });
    assert.equal(pdf.status, 200, await pdf.clone().text());
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    const changed = { ...layout.report, name: 'Persisted via preview' };
    const saved = await fetch(origin + '/api/report-layout', { method: 'POST', headers: { 'If-Match': layout.version }, body: JSON.stringify(changed) });
    assert.equal(saved.status, 200);
    assert.equal((await (await fetch(origin + '/api/report-layout')).json()).report.name, changed.name);
  } finally {
    await server?.close();
    if (previousLayout === undefined) delete process.env.REPORT_ENGINE_LAYOUT_FILE;
    else process.env.REPORT_ENGINE_LAYOUT_FILE = previousLayout;
    temporary.cleanup();
  }
});
