import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createReportRepository, ReportConflictError } from '../src/server/reportRepository';
import { createReportSync, type SyncStatus } from '../src/sync/reportSync';
import { reportFixture, temporaryDirectory } from './helpers';

test('repository rejects stale writes and preserves a corrupt file for diagnosis', () => {
  const temporary = temporaryDirectory();
  try {
    const file = path.join(temporary.directory, 'layout.json');
    const repository = createReportRepository(file);
    repository.initialize(reportFixture());
    const initial = repository.read();
    repository.write({ ...initial.report, name: 'Agent edit' });
    assert.throws(() => repository.write({ ...initial.report, name: 'Stale edit' }, initial.version), ReportConflictError);
    assert.equal(repository.read().report.name, 'Agent edit');
    assert.throws(() => repository.write({ bands: [] }));
    assert.equal(repository.read().report.name, 'Agent edit');
    fs.writeFileSync(file, '{corrupt');
    assert.throws(() => repository.read());
    assert.equal(fs.readFileSync(file, 'utf8'), '{corrupt');
  } finally { temporary.cleanup(); }
});

function syncHarness() {
  let report = reportFixture();
  let status: SyncStatus | undefined;
  const calls: { url: string; init?: RequestInit }[] = [];
  const responses: (() => Promise<Response>)[] = [];
  const session = createReportSync({
    getReport: () => report,
    setReport: next => { report = next; },
    onStatus: next => { status = next; },
    fetch: (async (url, init) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      assert.ok(next, 'Unexpected fetch request');
      return next();
    }) as typeof fetch,
  });
  return {
    session, calls, responses,
    getReport: () => report,
    getStatus: () => status,
    edit: (name: string) => { report = { ...report, name }; },
    respond: (body: unknown, status = 200) => responses.push(async () => Response.json(body, { status })),
  };
}

test('sync startup reads remote state without writing it back', async () => {
  const h = syncHarness();
  h.respond({ report: { ...reportFixture(), name: 'Remote' }, version: 'v1' });
  await h.session.sync();
  assert.equal(h.getReport().name, 'Remote');
  assert.equal(h.calls.length, 1);
  assert.equal(h.session.isDirty(), false);
});

test('an edit during a background read survives and saves with a version check', async () => {
  const h = syncHarness();
  let finish!: (response: Response) => void;
  h.responses.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.session.sync();
  h.edit('Local edit');
  h.respond({ version: 'v2' });
  finish(Response.json({ report: reportFixture(), version: 'v1' }));
  await pending;
  assert.equal(h.getReport().name, 'Local edit');
  assert.equal(h.calls[1].init?.method, 'POST');
  assert.ok(h.calls[1].init);
  assert.equal((h.calls[1].init.headers as Record<string, string>)['If-Match'], 'v1');
  assert.equal(h.session.isDirty(), false);
});

test('an edit during save remains dirty and cannot trigger overlapping requests', async () => {
  const h = syncHarness();
  h.respond({ report: reportFixture(), version: 'v1' });
  await h.session.sync();
  h.edit('First');
  let finish!: (response: Response) => void;
  h.responses.push(() => new Promise(resolve => { finish = resolve; }));
  const saving = h.session.sync();
  h.edit('Second');
  await h.session.sync();
  assert.equal(h.calls.length, 2);
  finish(Response.json({ version: 'v2' }));
  await saving;
  assert.equal(h.session.isDirty(), true);
  h.respond({ version: 'v3' });
  await h.session.sync();
  assert.equal(h.session.isDirty(), false);
  assert.equal(JSON.parse(h.calls[2].init?.body as string).name, 'Second');
});

test('a conflict preserves local edits and only explicit reload resolves it', async () => {
  const h = syncHarness();
  h.respond({ report: reportFixture(), version: 'v1' });
  await h.session.sync();
  h.edit('Unsaved');
  h.respond({ error: 'conflict' }, 409);
  await h.session.sync();
  assert.equal(h.getStatus()?.conflict, true);
  assert.equal(h.getReport().name, 'Unsaved');
  await h.session.sync();
  assert.equal(h.calls.length, 2);
  h.respond({ report: { ...reportFixture(), name: 'Agent edit' }, version: 'v2' });
  await h.session.sync(true);
  assert.equal(h.getReport().name, 'Agent edit');
  assert.equal(h.getStatus()?.conflict, false);
});

test('failed persistence retries without acknowledging the unsaved document', async () => {
  const h = syncHarness();
  h.respond({ report: reportFixture(), version: 'v1' });
  await h.session.sync();
  h.edit('Keep me');
  h.respond({}, 500);
  await h.session.sync();
  assert.equal(h.session.isDirty(), true);
  assert.ok(h.getStatus()?.error);
  h.respond({ version: 'v2' });
  await h.session.sync();
  assert.equal(h.session.isDirty(), false);
});

test('invalid remote documents leave the current report intact', async () => {
  const h = syncHarness();
  h.respond({ report: { bands: [] }, version: 'v1' });
  await h.session.sync();
  assert.deepEqual(h.getReport(), reportFixture());
  assert.ok(h.getStatus()?.error);
});

test('static hosting HTML fallback does not become a JSON sync error', async () => {
  const h = syncHarness();
  h.responses.push(async () => new Response('<!doctype html><html></html>', { headers: { 'Content-Type': 'text/html' } }));
  await h.session.sync();
  assert.equal(h.getStatus()?.error, null);
  assert.equal(h.getStatus()?.mcpSynced, false);
  assert.deepEqual(h.getReport(), reportFixture());
});
