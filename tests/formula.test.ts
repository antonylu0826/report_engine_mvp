import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateFormula, analyzeFormula } from '../src/formula/engine';
import { getFormulaCatalog } from '../src/formula/registry';
import { FormulaError, type FormulaContext } from '../src/formula/types';
import { serializeValue } from '../src/formula/values';
import { prepareReport, previewFormula, validateReportFormulas } from '../src/formula/report';
import { evaluateExpression } from '../src/compiler/evaluator';
import { expandDetailBands } from '../src/compiler/bandPipeline';
import { getSubReportBands } from '../src/report/subReport';
import { label, reportFixture } from './helpers';
import { ReportPDFDocument } from '../src/compiler/pdfCompiler';
import { formatValue } from '../src/compiler/formatters';

const value = (source: string, context: FormulaContext = {}) => serializeValue(evaluateFormula(source, context));
function code(expected: string) { return (error: unknown) => error instanceof FormulaError && error.diagnostics.some(d => d.code === expected); }

test('every published function example executes against the shared registry', () => {
  const catalog = getFormulaCatalog();
  assert.equal(catalog.functions.length, 38);
  for (const entry of catalog.functions) {
    assert.ok(entry.parameters && entry.examples.length >= 2 && entry.signature);
    for (const sample of entry.examples) assert.deepEqual(value(sample.expression, sample.context), sample.expected, `${entry.name}: ${sample.expression}`);
  }
});
test('all signatures reject invalid arity, and function boundaries produce stable diagnostics', () => {
  for (const entry of getFormulaCatalog().functions) {
    const args = entry.parameters.some(p => p.variadic) ? Array(257).fill('1') : Array(entry.parameters.length + 1).fill('1');
    assert.throws(() => value(`=${entry.name}(${args.join(',')})`), code('ARGUMENT_COUNT'), entry.name);
    if (entry.parameters.some(p => !p.optional)) assert.throws(() => value(`=${entry.name}()`), code('ARGUMENT_COUNT'), entry.name);
  }
  for (const source of ['=LEFT("x", -1)', '=MID("x", 0, 1)', '=ROUND(1, 101)', '=SUBSTITUTE("x", "", "y")', '=FORMAT_DATE("2024-01-01", "MMMM")']) assert.throws(() => value(source), code('INVALID_ARGUMENT'));
  for (const source of ['=1/0', '=MOD(1, 0)']) assert.throws(() => value(source), code('DIVISION_BY_ZERO'));
  assert.throws(() => value('=CONCAT(a, a)', { currentRow: { a: 'x'.repeat(60_000) } }), code('LIMIT_EXCEEDED'));
  assert.throws(() => value('=SUBSTITUTE(a, "x", a)', { currentRow: { a: 'x'.repeat(1000) } }), code('LIMIT_EXCEEDED'));
  assert.throws(() => value('=1' + '+1'.repeat(100)), code('LIMIT_EXCEEDED'));
  assert.throws(() => value('=NOW()', { timeZone: 'Invalid/Zone' }), code('INVALID_DATE'));
});
test('precedence, exact decimal math, explicit rounding, and lossless JSON decimals', () => {
  assert.equal(value('=2 + 3 * 4'), 14);
  assert.equal(value('=(2 + 3) * 4'), 20);
  assert.equal(value('=-2 * -3 + +1'), 7);
  assert.equal(value('=0.1 + 0.2'), 0.3);
  assert.equal(value('=SUM(amount)', { dataSource: [{ amount: 10.4 }, { amount: 10.4 }] }), 20.8);
  assert.equal(value('=SUM(ROUND(amount, 0))', { dataSource: [{ amount: 10.4 }, { amount: 10.4 }] }), 20);
  assert.equal(value('=9007199254740993 + 2'), '9007199254740995');
  assert.equal(formatValue(value('=9007199254740993 + 2'), 'N2'), '9,007,199,254,740,995.00');
  assert.equal(formatValue('2026-01-01', 'date:YYYY-MM-DD', 'America/Los_Angeles'), '2026-01-01');
  assert.equal(formatValue('2026-01-01T02:03:04Z', 'date:MM/dd HH:mm:ss', 'Asia/Taipei'), '01/01 10:03:04');
  assert.throws(() => value('=1e101'), code('NUMERIC_OVERFLOW'));
  assert.throws(() => value('=1e-101'), code('NUMERIC_OVERFLOW'));
});
test('null, lazy branching, strict types, missing schema values and aggregate emptiness', () => {
  assert.equal(value('=NULL * 5'), null);
  assert.equal(value('=COALESCE(NULL, 0) * 5'), 0);
  assert.equal(value('=IF(quantity = 0, 0, amount / quantity)', { currentRow: { quantity: 0, amount: 10 } }), 0);
  assert.throws(() => value('=IF(TRUE, 1, UNKNOWN())'), code('UNKNOWN_FUNCTION'));
  assert.throws(() => value('=1 + "2"'), code('TYPE_MISMATCH'));
  assert.equal(value('=AVG(amount)', { dataSource: [{ amount: 10 }, { amount: null }, { amount: 20 }] }), 15);
  for (const name of ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']) assert.equal(value(`=${name}(amount)`, { dataSource: [] }), ['SUM', 'COUNT'].includes(name) ? 0 : null);
  const context: FormulaContext = { schema: { detailFields: [{ name: 'amount', label: 'Amount', type: 'number' }] }, currentRow: {}, reportParameters: { amount: 99 } };
  assert.equal(value('=amount', context), null);
  assert.throws(() => value('=other', context), code('UNKNOWN_FIELD'));
  context.schema!.detailFields[0].nullable = false;
  assert.throws(() => value('=amount', context), code('MISSING_VALUE'));
  assert.throws(() => value('=SUM(SUM(amount))'), code('INVALID_SCOPE'));
});
test('bounded grammar rejects scripts and reports source positions', () => {
  for (const source of ['=process.exit()', '=globalThis', '=a[0]', '=x => x', '=1; 2', '=SUM(1,)']) assert.throws(() => value(source), FormulaError);
  assert.throws(() => value('=1 + @'), (error: unknown) => error instanceof FormulaError && error.diagnostics[0].span?.start === 5);
  assert.throws(() => value('('.repeat(100) + '1' + ')'.repeat(100)), code('LIMIT_EXCEEDED'));
  assert.ok(analyzeFormula('=IF(FALSE, 1 + "x", 1)').diagnostics.some(d => d.code === 'TYPE_MISMATCH'));
});
test('dates reject invalid input, preserve pure dates, clamp months and respect DST', () => {
  assert.throws(() => value('=DATE(2023, 2, 29)'), code('INVALID_DATE'));
  assert.throws(() => value('=TO_DATE("02/03/2026")'), code('INVALID_DATE'));
  assert.equal(value('=TO_DATE("2026-01-01")', { timeZone: 'America/Los_Angeles' }), '2026-01-01');
  assert.equal(value('=DATEADD("day", 1, "2024-03-09T17:00:00Z")', { timeZone: 'America/New_York' }), '2024-03-10T16:00:00Z');
  assert.equal(value('=DATEDIFF("hour", "2024-03-09T17:00:00Z", "2024-03-10T16:00:00Z")'), 23);
  assert.equal(value('=DATEDIFF("day", "2024-03-09T17:00:00Z", "2024-03-10T16:00:00Z")', { timeZone: 'America/New_York' }), 1);
  assert.equal(value('=DATEDIFF("month", "2024-01-31", "2024-03-01")'), 1);
});
function calculatedReport() {
  return { ...reportFixture(), calculatedFields: [
    { name: 'lineAmount', scope: 'row' as const, type: 'number' as const, expression: '=quantity * unitPrice' },
    { name: 'subtotal', scope: 'report' as const, type: 'number' as const, expression: '=SUM(calc.lineAmount)' },
    { name: 'tax', scope: 'report' as const, type: 'number' as const, expression: '=ROUND(calc.subtotal * params.taxRate, 2)' },
    { name: 'total', scope: 'report' as const, type: 'number' as const, expression: '=calc.subtotal + calc.tax' },
    { name: 'groupTotal', scope: 'group' as const, type: 'number' as const, expression: '=SUM(calc.lineAmount)' },
  ] };
}
test('dependency chains, group scope, run-local caches and immutable datasets', () => {
  const report = calculatedReport();
  report.bands.unshift({ id: 'gh', type: 'GroupHeader', groupBy: 'category', height: 20, controls: [] });
  report.bands.push({ id: 'gf', type: 'GroupFooter', height: 20, controls: [label({ type: 'Expression', expression: '=calc.groupTotal' })] });
  const data = [{ category: 'A', quantity: 2, unitPrice: 10.4 }, { category: 'B', quantity: 1, unitPrice: 10.4 }];
  const before = structuredClone(data);
  const context = prepareReport(report, { dataSource: data, reportParameters: { taxRate: 0.05 } });
  assert.equal(evaluateExpression('=calc.total', undefined, context), 32.76);
  const footers = expandDetailBands(report, context).filter(i => i.band.type === 'GroupFooter');
  assert.deepEqual(footers.map(i => evaluateExpression('=calc.groupTotal', undefined, i.context)), [20.8, 10.4]);
  assert.deepEqual(data, before);
  assert.equal(previewFormula(report, '=calc.total', { dataSource: data, reportParameters: { taxRate: 0.1 } }).value, 34.32);
  const validation = validateReportFormulas(report);
  assert.deepEqual(validation.dependencyOrder.$.slice(0, 4), ['lineAmount', 'subtotal', 'tax', 'total']);
  const footerGrouping = structuredClone(report);
  footerGrouping.bands.find(b => b.type === 'GroupHeader')!.groupBy = undefined;
  footerGrouping.bands.find(b => b.type === 'GroupFooter')!.groupBy = 'category';
  const groupedContext = prepareReport(footerGrouping, { dataSource: data, reportParameters: { taxRate: 0.05 } });
  assert.deepEqual(expandDetailBands(footerGrouping, groupedContext).filter(i => i.band.type === 'GroupFooter').map(i => evaluateExpression('=calc.groupTotal', undefined, i.context)), [20.8, 10.4]);
});
test('cycles, invalid scopes, type errors and runtime errors block PDF before rendering', () => {
  const report = calculatedReport();
  report.calculatedFields[1].expression = '=calc.tax';
  const result = validateReportFormulas(report);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some(d => d.code === 'CIRCULAR_REFERENCE' && d.dependencyPath?.join(' → ') === 'subtotal → tax → subtotal'));
  assert.throws(() => ReportPDFDocument({ report, data: [] }), code('CIRCULAR_REFERENCE'));
  const invalid = calculatedReport();
  invalid.calculatedFields[0].expression = '=calc.total';
  assert.ok(validateReportFormulas(invalid).diagnostics.some(d => d.code === 'INVALID_SCOPE'));
  const zero = reportFixture();
  zero.bands[0].controls = [label({ type: 'Expression', expression: '=1 / quantity' })];
  assert.throws(() => ReportPDFDocument({ report: zero, data: [{ quantity: 0 }] }), code('DIVISION_BY_ZERO'));
  const failed = validateReportFormulas(zero, { execute: true, dataSource: [{ quantity: 0 }] });
  assert.equal(failed.diagnostics[0].controlId, 'label');
  assert.equal(failed.diagnostics[0].rowIndex, 0);
  const divided = calculatedReport();
  divided.calculatedFields[0].expression = '=unitPrice / quantity';
  const nestedFailure = validateReportFormulas(divided, { execute: true, dataSource: [{ quantity: 2, unitPrice: 10 }, { quantity: 0, unitPrice: 20 }], reportParameters: { taxRate: 0.05 } });
  assert.equal(nestedFailure.diagnostics[0].fieldName, 'lineAmount');
  assert.equal(nestedFailure.diagnostics[0].path, 'calculatedFields[0].expression');
  assert.equal(nestedFailure.diagnostics[0].rowIndex, 1);
  assert.deepEqual(nestedFailure.diagnostics[0].dependencyPath, ['subtotal', 'lineAmount']);
});
test('child calculated namespaces and fixed time are isolated from parent rows', () => {
  const child = reportFixture();
  child.calculatedFields = [{ name: 'total', scope: 'report', type: 'number', expression: '=SUM(amount)' }];
  child.bands.push({ id: 'rf', type: 'ReportFooter', height: 20, controls: [label({ id: 'total', type: 'Expression', expression: '=calc.total' })] });
  const parent = reportFixture();
  parent.calculatedFields = [{ name: 'total', scope: 'report', type: 'number', expression: '=SUM(amount)' }];
  const control = label({ type: 'SubReport', subReportBinding: 'items', subReportDefinition: child });
  parent.bands[0].controls = [control];
  const rows = [{ amount: 99, items: [{ amount: 3 }, { amount: 5 }] }, { amount: 100, items: [{ amount: 7 }] }];
  const context = prepareReport(parent, { dataSource: rows, executionTime: '2026-10-24T00:00:00Z' });
  assert.equal(evaluateExpression('=calc.total', undefined, context), 199);
  const children = rows.map(currentRow => getSubReportBands(control, { ...context, currentRow }).find(b => b.band.type === 'ReportFooter')!);
  assert.deepEqual(children.map(b => evaluateExpression('=calc.total', undefined, b.context)), [8, 7]);
  assert.deepEqual(children.map(b => evaluateExpression('=NOW()', undefined, b.context)), ['2026-10-24T00:00:00Z', '2026-10-24T00:00:00Z']);
});
