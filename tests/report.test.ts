import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { parseReport } from '../src/report/schema';
import { getPageGeometry, CSS_PIXELS_PER_POINT } from '../src/report/geometry';
import { patchControl, updateReportBand, updateReportScope } from '../src/report/operations';
import { inspectReportLayout, renderReportToSvg } from '../src/inspector/layoutInspector';
import { sampleOrderReport, sampleOrderData14 } from '../src/mock/sampleReport';
import { useReportStore } from '../src/store/useReportStore';
import { getSubReportContext, getSubReportRows } from '../src/report/subReport';
import { evaluateExpression, getNestedValue } from '../src/compiler/evaluator';
import { formatValue } from '../src/compiler/formatters';
import { expandDetailBands } from '../src/compiler/bandPipeline';
import { getSubReportBands } from '../src/report/subReport';
import { label, reportFixture } from './helpers';

afterEach(() => useReportStore.getState().resetToSample());

test('sample report validates without dropping properties', () => assert.deepEqual(parseReport(sampleOrderReport), sampleOrderReport));

test('schema rejects malformed reports, nested geometry and duplicate identities', () => {
  const report = reportFixture();
  assert.throws(() => parseReport({ bands: [] }));
  assert.throws(() => parseReport({ ...report, pageSettings: { ...report.pageSettings, margins: { top: 0, left: 500, right: 500, bottom: 0 } } }));
  assert.throws(() => parseReport({ ...report, bands: [{ ...report.bands[0], controls: [label(), label()] }] }));
  const child = reportFixture();
  child.bands[0].controls[0].width = Number.NaN;
  report.bands[0].controls = [label({ type: 'SubReport', subReportDefinition: child })];
  assert.throws(() => parseReport(report));
});

test('landscape dimensions are shared by inspector and SVG', () => {
  const report = reportFixture();
  report.pageSettings.orientation = 'landscape';
  const page = getPageGeometry(report.pageSettings);
  assert.equal(page.width, 841.89);
  assert.equal(page.height, 595.28);
  assert.equal(inspectReportLayout(report).printableWidth, page.printableWidth);
  assert.match(renderReportToSvg(report), /viewBox="0 0 841.89 595.28"/);
  assert.equal(96 / CSS_PIXELS_PER_POINT, 72);
});

test('nested patches preserve source objects, sibling controls and merged styles', () => {
  const report = reportFixture();
  report.bands[0].controls = [label({ id: 'sub', type: 'SubReport', subReportDefinition: reportFixture() })];
  const before = structuredClone(report);
  const updated = updateReportScope(report, scope => patchControl(scope, 'Detail', 'label', {
    text: 'Changed', style: { fontSize: 14 },
  }), 'sub');
  assert.deepEqual(report, before);
  assert.equal(updated.bands[0].controls[0].subReportDefinition?.bands[0].controls[0].text, 'Changed');
  assert.throws(() => patchControl(report, 'detail', 'missing', { text: 'x' }));
  assert.throws(() => updateReportBand(report, 'missing', band => band));
});

test('subreport editor mutations cannot replace the main report bands', () => {
  const store = useReportStore.getState();
  const rootIds = store.report.bands.map(b => b.id);
  store.enterSubReportEditor('band-detail', 'ctl-subreport-serials');
  const active = store.getActiveReport();
  const detail = active.bands.find(b => b.type === 'Detail')!;
  store.updateBand(detail.id, { keepTogether: true });
  store.updateControl(detail.id, detail.controls[0].id, { text: 'edited', style: { color: '#123456' } });
  store.addControl(detail.id, { type: 'Label', x: 0, y: 0, width: 20, height: 10 });
  assert.deepEqual(useReportStore.getState().report.bands.map(b => b.id), rootIds);
  const changed = store.getActiveReport().bands.find(b => b.id === detail.id)!;
  assert.equal(changed.keepTogether, true);
  assert.equal(changed.controls.length, detail.controls.length + 1);
  assert.equal(changed.controls[0].style?.color, '#123456');
  store.setReport(reportFixture());
  assert.equal(useReportStore.getState().editingSubReportPath, null);
  assert.equal(useReportStore.getState().selectedControlId, null);
});

test('reset returns an independent sample and invalid editor targets are ignored', () => {
  const store = useReportStore.getState();
  store.enterSubReportEditor('missing', 'missing');
  assert.equal(useReportStore.getState().editingSubReportPath, null);
  store.updateControl('band-detail', 'ctl-subreport-serials', { text: 'changed' });
  store.resetToSample();
  assert.deepEqual(useReportStore.getState().report, sampleOrderReport);
  assert.notEqual(useReportStore.getState().report, sampleOrderReport);
});

test('nested inspection uses the actual control width and counts expression columns', () => {
  const child = reportFixture();
  child.bands[0].controls = [label({ type: 'Expression', expression: '=ROW_INDEX', x: 90, width: 100 })];
  child.bands.unshift({ id: 'header', type: 'PageHeader', height: 20, controls: [label({ id: 'header-label', x: 90, width: 100 })] });
  const parent = reportFixture();
  parent.bands[0].controls = [label({ type: 'SubReport', width: 150, subReportDefinition: child })];
  const inspection = inspectReportLayout(parent);
  assert.equal(inspection.totalControls, 3);
  assert.equal(inspection.totalBands, 3);
  assert.equal(inspection.isValid, false);
  assert.equal(inspection.diagnostics.filter(d => d.category === 'alignment').length, 0);
});

test('SVG escapes nested text and attributes and computes actual aggregates', () => {
  const child = reportFixture();
  child.bands[0].controls = [label({ type: 'Field', fieldName: 'name' })];
  const report = reportFixture();
  report.bands[0].controls = [label({ type: 'SubReport', width: 300, subReportBinding: 'nested.rows', subReportDefinition: child })];
  const svg = renderReportToSvg(report, [{ nested: { rows: [{ name: '<script>&"' }] } }]);
  assert.ok(svg.includes('&lt;script&gt;&amp;&quot;'));
  assert.ok(!svg.includes('<script>'));
  assert.ok(!renderReportToSvg(report, []).includes('合格 PASS'));
  const summary = reportFixture();
  summary.bands = [{ id: 'summary', type: 'ReportFooter', height: 20, controls: [label({ type: 'Expression', expression: '=SUM(amount)' })] }];
  assert.match(renderReportToSvg(summary, [{ amount: 7 }, { amount: 8 }]), />15<\/text>/);
});

test('empty and malformed nested data never become sample serial numbers', () => {
  const control = label({ type: 'SubReport', subReportBinding: 'items' });
  assert.deepEqual(getSubReportRows(control, { currentRow: { items: [] } }), []);
  assert.deepEqual(getSubReportRows(control, { currentRow: { items: 'invalid' } }), []);
  const context = getSubReportContext(control, { currentRow: { items: [{ amount: 3 }, { amount: 5 }] }, dataSource: [{ amount: 999 }] });
  assert.equal(evaluateExpression('=SUM(amount)', undefined, context), 8);
});

test('expressions handle empty aggregates, mixed case and non-finite data', () => {
  assert.equal(evaluateExpression('=Avg(amount)', undefined, { dataSource: [] }), 0);
  assert.equal(evaluateExpression('=Sum(amount)', undefined, { dataSource: [{ amount: 2 }, { amount: Infinity }] }), 2);
  assert.equal(getNestedValue({}, 'constructor'), undefined);
  assert.equal(evaluateExpression(undefined, 'name', { reportParameters: { name: 'Header' } }), 'Header');
});

test('formatters support declared formats and safely reject excessive precision', () => {
  assert.equal(formatValue(1234.5, 'number:0.00'), '1,234.50');
  assert.equal(formatValue(1234.5, '#,##0.00'), '1,234.50');
  assert.equal(formatValue(1, 'C99'), '1');
  assert.equal(formatValue(1, 'Custom'), '1');
  assert.equal(formatValue(new Date(2026, 9, 23), 'date:yyyy/MM/dd'), '2026/10/23');
  assert.equal(formatValue(null, 'C0'), '');
  assert.ok(renderReportToSvg(sampleOrderReport, sampleOrderData14).startsWith('<svg'));
});

test('band expansion groups deterministically and breaks only between groups', () => {
  const report = reportFixture();
  report.bands.unshift({ id: 'gh', type: 'GroupHeader', height: 20, controls: [], groupBy: 'category', pageBreakBefore: true });
  report.bands.push({ id: 'gf', type: 'GroupFooter', height: 20, controls: [], pageBreakAfter: true });
  const instances = expandDetailBands(report, { dataSource: [
    { category: 'B', amount: 10 }, { category: 'A', amount: 2 }, { category: 'A', amount: 3 },
  ] });
  assert.deepEqual(instances.map(i => i.band.type), ['GroupHeader', 'Detail', 'Detail', 'GroupFooter', 'GroupHeader', 'Detail', 'GroupFooter']);
  assert.equal(instances[0].pageBreakBefore, false);
  assert.equal(instances[4].pageBreakBefore, true);
  assert.equal(instances[3].pageBreakAfter, true);
  assert.equal(instances[6].pageBreakAfter, undefined);
  assert.equal(evaluateExpression('=SUM(amount)', undefined, instances[3].context), 5);
});

test('child grouping uses its own dataset and active data follows custom bindings', () => {
  const child = reportFixture();
  child.bands.unshift({ id: 'gh', type: 'GroupHeader', height: 20, controls: [], groupBy: 'category' });
  child.bands.push({ id: 'gf', type: 'GroupFooter', height: 20, controls: [] });
  const control = label({ id: 'sub', type: 'SubReport', subReportBinding: 'custom.rows', subReportDefinition: child });
  const rows = [{ category: 'A', amount: 5 }, { category: 'B', amount: 8 }];
  const instances = getSubReportBands(control, { currentRow: { custom: { rows } }, dataSource: [{ amount: 999 }] });
  const footers = instances.filter(i => i.band.type === 'GroupFooter');
  assert.deepEqual(footers.map(i => evaluateExpression('=SUM(amount)', undefined, i.context)), [5, 8]);
  const report = reportFixture();
  report.bands[0].controls = [control];
  const store = useReportStore.getState();
  store.setReport(report);
  store.setData([{ custom: { rows } }]);
  store.enterSubReportEditor('detail', 'sub');
  assert.deepEqual(store.getActiveData(), rows);
});
