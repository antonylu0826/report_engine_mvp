import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { createServer } from 'vite';
import { reportLayoutPlugin } from '../src/server/layoutPlugin';
import { createReportRepository } from '../src/server/reportRepository';
import { reportFixture, temporaryDirectory } from './helpers';

test('sync HTTP API validates documents and rejects stale saves without data loss', async () => {
  const temporary = temporaryDirectory();
  const file = path.join(temporary.directory, 'layout.json');
  const repository = createReportRepository(file);
  repository.initialize(reportFixture());
  const vite = await createServer({
    configFile: false, root: temporary.directory, server: { middlewareMode: true, hmr: false },
    plugins: [reportLayoutPlugin(file)], logLevel: 'silent',
  });
  const server = http.createServer(vite.middlewares);
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/api/report-layout`;
    const initialResponse = await fetch(url);
    assert.equal(initialResponse.headers.get('cache-control'), 'no-store');
    const initial = await initialResponse.json();
    const invalid = await fetch(url, { method: 'POST', body: JSON.stringify({ bands: [] }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual(repository.read().report, initial.report);
    const malformed = await fetch(url, { method: 'POST', body: '{bad' });
    assert.equal(malformed.status, 400);
    const saved = await fetch(url, {
      method: 'POST', headers: { 'If-Match': initial.version },
      body: JSON.stringify({ ...initial.report, name: 'Saved' }),
    });
    assert.equal(saved.status, 200);
    const stale = await fetch(url, {
      method: 'POST', headers: { 'If-Match': initial.version }, body: JSON.stringify(initial.report),
    });
    assert.equal(stale.status, 409);
    assert.equal(repository.read().report.name, 'Saved');
    assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await vite.close();
    temporary.cleanup();
  }
});
