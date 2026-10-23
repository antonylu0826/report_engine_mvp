import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { handleReportApi } from '../src/server/reportApi';
import { requestReportPdf } from '../src/client/reportPdf';
import { reportFixture, label } from './helpers';
import { sampleOrderReport, sampleOrderDataSource, sampleOrderData14 } from '../src/mock/sampleReport';

test('HTTP formula discovery and PDF generation use validation with structured failures', async () => {
  const server = http.createServer((req, res) => { void handleReportApi(req, res).then(handled => { if (!handled) { res.statusCode = 404; res.end(); } }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const catalog = await (await fetch(url + '/api/formula-catalog?category=date')).json();
    assert.equal(catalog.functions.length, 9);
    assert.ok(catalog.functions.some((f: { name: string }) => f.name === 'DATEADD'));
    const input = { report: sampleOrderReport, data: sampleOrderData14, dataSource: sampleOrderDataSource, executionTime: '2026-10-24T00:00:00Z', timeZone: 'Asia/Taipei' };
    const validated = await post('/api/validate-report-formulas', input);
    assert.equal((await validated.json()).valid, true);
    const success = await post('/api/report-pdf', input);
    assert.equal(success.status, 200);
    assert.match(success.headers.get('content-type')!, /application\/pdf/);
    assert.equal(success.headers.get('cache-control'), 'no-store');
    const bytes = Buffer.from(await success.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const broken = reportFixture();
    broken.bands[0].controls = [label({ type: 'Expression', expression: '=1 / quantity' })];
    const failure = await post('/api/report-pdf', { report: broken, data: [{ quantity: 0 }] });
    assert.equal(failure.status, 422);
    const diagnostic = await failure.json();
    assert.equal(diagnostic.diagnostics[0].code, 'DIVISION_BY_ZERO');
    assert.equal(diagnostic.diagnostics[0].controlId, 'label');
    assert.equal(diagnostic.diagnostics[0].rowIndex, 0);
    broken.bands[0].controls[0].expression = '=UNKNOWN()';
    assert.equal((await post('/api/report-pdf', { report: broken, data: [] })).status, 422);
    assert.equal((await post('/api/report-pdf', { report: { bands: [] } })).status, 400);
    assert.equal((await fetch(url + '/api/report-pdf')).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('preview and export share bytes; failed requests retry and refresh creates a new snapshot', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0, fail = false;
  globalThis.fetch = (async () => {
    calls++;
    return fail ? new Response(JSON.stringify({ error: 'Formula failed' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
      : new Response(`%PDF-snapshot-${calls}`, { headers: { 'Content-Type': 'application/pdf' } });
  }) as typeof fetch;
  try {
    const report = reportFixture(), data = [{ amount: 3 }];
    const [preview, download] = await Promise.all([requestReportPdf(report, data, sampleOrderDataSource), requestReportPdf(report, data, sampleOrderDataSource)]);
    assert.equal(calls, 1);
    assert.equal(preview, download);
    assert.equal(await preview.text(), '%PDF-snapshot-1');
    const refreshed = await requestReportPdf(report, data, sampleOrderDataSource, true);
    assert.equal(await refreshed.text(), '%PDF-snapshot-2');
    fail = true;
    await assert.rejects(requestReportPdf({ ...report, name: 'invalid' }, data, sampleOrderDataSource), /Formula failed/);
    fail = false;
    assert.ok(await requestReportPdf({ ...report, name: 'invalid' }, data, sampleOrderDataSource));
    assert.equal(calls, 4);
  } finally { globalThis.fetch = originalFetch; }
});
