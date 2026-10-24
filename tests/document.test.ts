import { replaceFileAtomically } from '../src/server/atomicFile';
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createDocumentRepository } from "../src/server/documentRepository";
import { parseDataSource } from "../src/data/schema";
import { createReportSync } from "../src/sync/reportSync";
import { reportFixture, temporaryDirectory } from "./helpers";
import type { ReportDocument } from "../src/types/document";
const initial = (): ReportDocument => ({
  formatVersion: 1,
  report: reportFixture(),
  dataSource: {
    id: "external",
    name: "External",
    schema: {
      detailFields: [
        { name: "price", label: "Price", type: "number", nullable: false },
        {
          name: "children",
          label: "Children",
          type: "array",
          children: [{ name: "ready", label: "Ready", type: "boolean" }],
        },
      ],
    },
    data: { items: [{ price: 2, children: [{ ready: true }] }] },
  },
});
test("document repository migrates legacy reports on save and versions data changes atomically", () => {
  const temporary = temporaryDirectory();
  try {
    const file = path.join(temporary.directory, "layout.json"),
      document = initial();
    fs.writeFileSync(file, JSON.stringify(document.report));
    const repository = createDocumentRepository(file, document),
      before = fs.readFileSync(file, "utf8"),
      legacy = repository.read();
    assert.equal(legacy.legacy, true);
    assert.equal(fs.readFileSync(file, "utf8"), before);
    const saved = repository.write(legacy, legacy.version);
    assert.equal(saved.legacy, false);
    assert.deepEqual(repository.read().dataSource, document.dataSource);
    const changed = {
      ...document,
      dataSource: { ...document.dataSource, data: { items: [{ price: 4 }] } },
    };
    const next = repository.write(changed, saved.version);
    assert.notEqual(next.version, saved.version);
    assert.throws(
      () => repository.write(document, saved.version),
      /changed on disk/,
    );
    assert.deepEqual(repository.read().dataSource.data.items, [{ price: 4 }]);
    const content = fs.readFileSync(file, "utf8");
    assert.throws(
      () =>
        repository.write({
          ...changed,
          dataSource: {
            ...changed.dataSource,
            data: { items: [{ price: "bad" }] },
          },
        }),
      /Expected number/,
    );
    assert.equal(fs.readFileSync(file, "utf8"), content);
  } finally {
    temporary.cleanup();
  }
});
test("data schema rejects invalid nested values, duplicate child fields and invalid calendar dates", () => {
  const source = initial().dataSource;
  assert.throws(
    () =>
      parseDataSource({
        ...source,
        data: { items: [{ price: 2, children: [{ ready: "yes" }] }] },
      }),
    /Expected boolean/,
  );
  assert.throws(
    () => parseDataSource({ ...source, data: { items: [{}] } }),
    /Required value/,
  );
  assert.throws(
    () =>
      parseDataSource({
        ...source,
        schema: {
          detailFields: [
            {
              name: "children",
              label: "Children",
              type: "array",
              children: [
                { name: "x", label: "X", type: "string" },
                { name: "x", label: "X", type: "string" },
              ],
            },
          ],
        },
      }),
    /unique/,
  );
  assert.throws(
    () =>
      parseDataSource({
        ...source,
        schema: {
          detailFields: [{ name: "date", label: "Date", type: "date" }],
        },
        data: { items: [{ date: "2026-02-30" }] },
      }),
    /valid ISO date/,
  );
});
test("sync saves data-only edits and retains a newer edit made during the save", async () => {
  let local = initial(),
    release: (() => void) | undefined;
  const posts: ReportDocument[] = [];
  const sync = createReportSync({
    getReport: () => local.report,
    getDataSource: () => local.dataSource,
    setReport: (report) => {
      local = { ...local, report };
    },
    setDocument: (document) => {
      local = document;
    },
    onStatus: () => {},
    fetch: (async (_url, init) => {
      if (!init?.method) return Response.json({ ...initial(), version: "v1" });
      posts.push(JSON.parse(String(init.body)));
      if (posts.length === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return Response.json({ version: `v${posts.length + 1}` });
    }) as typeof fetch,
  });
  await sync.sync();
  local = {
    ...local,
    dataSource: { ...local.dataSource, data: { items: [{ price: 8 }] } },
  };
  const saving = sync.sync();
  local = {
    ...local,
    dataSource: { ...local.dataSource, data: { items: [{ price: 9 }] } },
  };
  release!();
  await saving;
  assert.equal(sync.isDirty(), true);
  await sync.sync();
  assert.equal(sync.isDirty(), false);
  assert.deepEqual(
    posts.map((post) => post.dataSource.data.items[0].price),
    [8, 9],
  );
  sync.dispose();
});


test('Windows atomic replacement retries sharing violations and rechecks the version before retry', () => {
  let attempts=0, checks=0; const pauses: number[]=[];
  replaceFileAtomically('temporary','destination',{platform:'win32',beforeReplace:()=>{checks++;},pause:delay=>{pauses.push(delay);},rename:()=>{
    attempts++; if(attempts<3)throw Object.assign(new Error('locked'),{code:'EPERM'});
  }});
  assert.equal(attempts,3);assert.equal(checks,3);assert.deepEqual(pauses,[10,20]);
  attempts=0;checks=0;
  assert.throws(()=>replaceFileAtomically('temporary','destination',{platform:'win32',pause:()=>{},beforeReplace:()=>{if(++checks>1)throw new Error('stale version');},rename:()=>{attempts++;throw Object.assign(new Error('locked'),{code:'EPERM'});}}),/stale version/);
  assert.equal(attempts,1);
  assert.throws(()=>replaceFileAtomically('temporary','destination',{platform:'win32',pause:()=>{},rename:()=>{throw Object.assign(new Error('bad path'),{code:'ENOENT'});}}),/bad path/);
});
