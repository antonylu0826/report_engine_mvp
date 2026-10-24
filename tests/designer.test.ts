import assert from "node:assert/strict";
import { test } from "node:test";
import { createReportStore } from "../src/store/useReportStore";
import { label, reportFixture } from "./helpers";
import type { ReportDocument } from "../src/types/document";
function document(): ReportDocument {
  const report = reportFixture();
  report.bands[0].height = 200;
  report.bands[0].controls = [
    label({ id: "a", x: 10, y: 10, width: 20 }),
    label({ id: "b", x: 60, y: 30, width: 30 }),
    label({ id: "c", x: 140, y: 60, width: 20 }),
  ];
  return {
    formatVersion: 1,
    report,
    dataSource: {
      id: "test",
      name: "Test",
      schema: { detailFields: [] },
      data: { items: [] },
    },
  };
}
test("designer instances own independent history, clipboard and initial reset documents", () => {
  const a = createReportStore(document()),
    b = createReportStore(document());
  const state = a.getState();
  state.selectControl("detail", "a");
  state.copySelection();
  state.pasteSelection();
  assert.equal(a.getState().report.bands[0].controls.length, 4);
  assert.equal(b.getState().report.bands[0].controls.length, 3);
  b.getState().selectControl("detail", "a");
  b.getState().pasteSelection();
  assert.equal(b.getState().report.bands[0].controls.length, 3);
  state.undo();
  assert.equal(a.getState().report.bands[0].controls.length, 3);
  state.redo();
  assert.equal(a.getState().report.bands[0].controls.length, 4);
  state.resetToSample();
  assert.deepEqual(a.getState().report, document().report);
});
test("pointer transactions coalesce edits, ignore no-ops and preserve redo until an actual edit", () => {
  const store = createReportStore(document()),
    s = store.getState();
  s.beginTransaction();
  s.updateControl("detail", "a", { x: 11 });
  s.updateControl("detail", "a", { x: 12 });
  s.endTransaction();
  s.undo();
  assert.equal(store.getState().report.bands[0].controls[0].x, 10);
  assert.equal(store.getState().canUndo, false);
  s.updateControl("detail", "a", { x: 10 });
  assert.equal(store.getState().canRedo, true);
  s.redo();
  assert.equal(store.getState().report.bands[0].controls[0].x, 12);
  s.undo();
  s.updateControl("detail", "a", { x: 13 });
  assert.equal(store.getState().canRedo, false);
});
test("multiselection moves as a bounded group, aligns and distributes with one undo step", () => {
  const store = createReportStore(document()),
    s = store.getState();
  s.selectControl("detail", "a");
  s.toggleControl("detail", "b");
  s.toggleControl("detail", "c");
  s.moveSelection(-100, -100);
  assert.deepEqual(
    store.getState().report.bands[0].controls.map((c) => [c.x, c.y]),
    [
      [0, 0],
      [50, 20],
      [130, 50],
    ],
  );
  s.arrangeSelection("top");
  assert.deepEqual(
    store.getState().report.bands[0].controls.map((c) => c.y),
    [0, 0, 0],
  );
  s.arrangeSelection("horizontal");
  assert.deepEqual(
    store.getState().report.bands[0].controls.map((c) => c.x),
    [0, 60, 130],
  );
  s.undo();
  assert.deepEqual(
    store.getState().report.bands[0].controls.map((c) => c.x),
    [0, 50, 130],
  );
});
test("copying child reports recursively regenerates identities and child edits stay in scope", () => {
  const doc = document(),
    child = reportFixture();
  doc.report.bands[0].controls = [
    label({ id: "sub", type: "SubReport", subReportDefinition: child }),
  ];
  const store = createReportStore(doc),
    s = store.getState();
  s.selectControl("detail", "sub");
  s.copySelection();
  s.pasteSelection();
  const [original, copy] = store.getState().report.bands[0].controls;
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.subReportDefinition!.id, child.id);
  assert.notEqual(copy.subReportDefinition!.bands[0].id, child.bands[0].id);
  assert.notEqual(
    copy.subReportDefinition!.bands[0].controls[0].id,
    child.bands[0].controls[0].id,
  );
  s.enterSubReportEditor("detail", "sub");
  s.selectControl("detail", "label");
  s.copySelection();
  s.pasteSelection();
  assert.equal(store.getState().report.bands[0].controls.length, 2);
  assert.equal(
    store.getState().report.bands[0].controls[0].subReportDefinition!.bands[0]
      .controls.length,
    2,
  );
});
test("document history includes data and external reload clears stale history and selection", () => {
  const store = createReportStore(document()),
    s = store.getState();
  const initial = s.getDocument();
  s.setData([{ value: 1 }]);
  s.undo();
  assert.deepEqual(store.getState().data, []);
  s.redo();
  assert.deepEqual(store.getState().data, [{ value: 1 }]);
  s.selectControl("detail", "a");
  s.setDocument(initial, true);
  assert.equal(store.getState().canUndo, false);
  assert.equal(store.getState().canRedo, false);
  assert.deepEqual(store.getState().selectedControlIds, []);
});
