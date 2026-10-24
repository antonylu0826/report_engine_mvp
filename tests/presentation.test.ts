import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluatePredicate,
  resolveControlAppearance,
} from "../src/formula/presentation";
import { prepareReport, validateReportFormulas } from "../src/formula/report";
import { preflightDocument, preflightReport } from "../src/report/preflight";
import { ReportPDFDocument } from "../src/compiler/pdfCompiler";
import { parseReport } from "../src/report/schema";
import { label, reportFixture } from "./helpers";
import { createReportStore } from "../src/store/useReportStore";
import type { ReportDocument } from "../src/types/document";

test("print predicates use strict booleans and ordered styles without mutating definitions", () => {
  assert.equal(evaluatePredicate("=NULL", {}), false);
  assert.throws(() => evaluatePredicate("=1", {}), /boolean/);
  const control = label({
    visibleWhen: "=amount < 0",
    style: { color: "#111111", fontWeight: "normal" },
    styleRules: [
      { when: "=amount < 0", style: { color: "#dc2626" } },
      { when: "=amount < -5", style: { fontWeight: "bold", color: "#991b1b" } },
    ],
  });
  const before = structuredClone(control),
    resolved = resolveControlAppearance(control, {
      currentRow: { amount: -10 },
      dataSource: [{ amount: -10 }],
    });
  assert.deepEqual(resolved?.style, { color: "#991b1b", fontWeight: "bold" });
  assert.deepEqual(control, before);
  assert.equal(
    resolveControlAppearance(
      {
        ...control,
        visibleWhen: "=FALSE",
        styleRules: [{ when: "=1 / 0 > 0", style: { color: "red" } }],
      },
      {},
    ),
    null,
  );
});
test("conditions are statically checked in every branch and runtime hidden content is skipped", () => {
  const report = reportFixture();
  report.bands[0].controls = [
    label({
      type: "Expression",
      expression: "=1 / quantity",
      visibleWhen: "=quantity > 0",
    }),
  ];
  assert.equal(
    preflightReport(report, { dataSource: [{ quantity: 0 }, { quantity: 2 }] })
      .valid,
    true,
  );
  report.bands[0].visibleWhen = "=FALSE";
  report.bands[0].controls[0].visibleWhen = undefined;
  assert.equal(
    preflightReport(report, { dataSource: [{ quantity: 0 }] }).valid,
    true,
  );
  report.bands[0].controls[0].styleRules = [
    { when: "=UNKNOWN()", style: { color: "red" } },
  ];
  assert.equal(validateReportFormulas(report).valid, false);
  report.bands[0].controls[0].styleRules = [
    { when: "=1", style: { color: "red" } },
  ];
  assert.ok(
    validateReportFormulas(report).diagnostics.some(
      (d) =>
        d.code === "TYPE_MISMATCH" && d.path?.endsWith(".styleRules[0].when"),
    ),
  );
});
test("nested condition failures have exact paths and scopes; unsupported styles are rejected", () => {
  const child = reportFixture();
  child.bands[0].controls = [
    label({
      styleRules: [{ when: "=1 / value > 0", style: { color: "red" } }],
    }),
  ];
  const report = reportFixture();
  report.bands[0].controls = [
    label({
      id: "child",
      type: "SubReport",
      width: 300,
      subReportBinding: "children",
      subReportDefinition: child,
    }),
  ];
  const result = preflightReport(report, {
    dataSource: [{ children: [{ value: 0 }] }],
  });
  const diagnostic = result.diagnostics.find(
    (d) => d.code === "DIVISION_BY_ZERO",
  )!;
  assert.equal(
    diagnostic.path,
    "bands[0].controls[0].subReportDefinition.bands[0].controls[0].styleRules[0].when",
  );
  assert.deepEqual(diagnostic.subReportControlPath, ["child"]);
  assert.equal(diagnostic.controlId, "label");
  const invalid = reportFixture();
  invalid.bands[0].controls = [
    label({
      type: "Image",
      styleRules: [{ when: "=TRUE", style: { color: "red" } }],
    }),
  ];
  assert.throws(
    () => parseReport(invalid),
    /not a supported conditional style/,
  );
});
test("preflight unifies geometry, binding, data and malformed structure diagnostics with PDF", () => {
  const report = reportFixture();
  report.bands[0].controls = [
    label({ type: "Field", fieldName: "missing", x: 1000 }),
  ];
  const result = preflightReport(report, {
    schema: { detailFields: [] },
    dataSource: [{}],
  });
  assert.ok(
    result.diagnostics.some(
      (d) => d.code === "CONTROL_WIDTH_OVERFLOW" && d.controlId === "label",
    ),
  );
  assert.ok(
    result.diagnostics.some(
      (d) => d.code === "UNKNOWN_FIELD" && d.controlId === "label",
    ),
  );
  assert.throws(
    () =>
      ReportPDFDocument({
        report,
        data: [{}],
        dataSource: {
          id: "x",
          name: "X",
          schema: { detailFields: [] },
          data: { items: [{}] },
        },
      }),
    /available width/,
  );
  assert.equal(
    preflightDocument({
      formatVersion: 1,
      report: { bands: [null] },
      dataSource: {},
    }).valid,
    false,
  );
  const document: ReportDocument = {
    formatVersion: 1,
    report: reportFixture(),
    dataSource: {
      id: "x",
      name: "X",
      schema: {
        detailFields: [
          {
            name: "required",
            label: "Required",
            type: "number",
            nullable: false,
          },
        ],
      },
      data: { items: [{}] },
    },
  };
  assert.ok(
    preflightDocument(document).diagnostics.some((d) => d.category === "data"),
  );
});
test("diagnostic navigation selects root and child controls without adding history", () => {
  const child = reportFixture(),
    report = reportFixture();
  report.bands[0].controls = [
    label({
      id: "parent",
      type: "SubReport",
      subReportDefinition: child,
      width: 300,
    }),
  ];
  const store = createReportStore({
    formatVersion: 1,
    report,
    dataSource: {
      id: "x",
      name: "X",
      schema: { detailFields: [] },
      data: { items: [] },
    },
  });
  store
    .getState()
    .focusDiagnostic({
      code: "TEST",
      severity: "error",
      category: "formula",
      message: "test",
      bandId: "detail",
      controlId: "label",
      subReportControlPath: ["parent"],
    });
  assert.deepEqual(store.getState().editingSubReportPath, {
    bandId: "detail",
    controlId: "parent",
  });
  assert.equal(store.getState().selectedControlId, "label");
  assert.equal(store.getState().activeTab, "designer");
  assert.equal(store.getState().canUndo, false);
});
test("hidden rows remain in aggregate inputs and all calculations keep their original semantics", () => {
  const report = reportFixture();
  report.calculatedFields = [
    {
      name: "sum",
      scope: "report",
      type: "number",
      expression: "=SUM(amount)",
    },
  ];
  report.bands[0].visibleWhen = "=amount > 0";
  const context = prepareReport(report, {
    dataSource: [{ amount: 5 }, { amount: -2 }],
  });
  assert.equal(String(context.resolveCalculated!("sum", context)), "3");
});

test("fixed page regions can exceed the remaining body without being misclassified as body bands", () => {
  const report = reportFixture();
  report.bands.unshift({
    id: "large-header",
    type: "PageHeader",
    height: 500,
    controls: [label({ id: "heading", height: 490 })],
  });
  assert.equal(preflightReport(report, { dataSource: [{}] }).valid, true);
});
