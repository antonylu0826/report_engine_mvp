import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { temporaryDirectory } from '../tests/helpers';

const temporary = temporaryDirectory();
const layoutFile = path.join(temporary.directory, 'layout.json');
const client = new Client({ name: 'report-engine-regression-tests', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', import.meta.resolve('tsx'), path.resolve('src/mcp/index.ts')],
  cwd: temporary.directory,
  env: {
    ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    TSX_TSCONFIG_PATH: path.resolve('tsconfig.app.json'),
    REPORT_ENGINE_LAYOUT_FILE: layoutFile,
    REPORT_ENGINE_ASSETS_DIR: temporary.directory,
  },
  stderr: 'pipe',
});
let stderr = '';
transport.stderr?.on('data', chunk => { stderr += String(chunk); });
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
  return result;
}
async function read() {
  const result = await call('get_report_layout');
  const content = result.content as { type: string; text: string }[];
  return JSON.parse(content[0].text);
}

try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 22);
  const catalogReply = await call('get_formula_catalog');
  const catalog = JSON.parse((catalogReply.content as { text: string }[])[0].text);
  assert.equal(catalog.functions.length, 38);
  assert.ok(catalog.functions.every((f: { signature: string; examples: unknown[] }) => f.signature && f.examples.length >= 2));
  await call('update_page_settings', { orientation: 'landscape' });
  assert.equal((await read()).pageInfo.printableWidth, 761.89);
  await call('reset_report_layout');
  await call('add_control', {
    bandId: 'Detail',
    control: { id: 'test-label', type: 'Label', x: 0, y: 0, width: 10, height: 10, text: 'Before', style: { fontSize: 8, color: '#111111' } },
  });
  await call('batch_update_controls', { updates: [
    { bandId: 'Detail', controlId: 'test-label', patch: { text: 'After' } },
    { bandId: 'Detail', controlId: 'test-label', patch: { style: { color: '#222222' } } },
  ] });
  let layout = await read();
  const control = layout.report.bands.find((b: { type: string }) => b.type === 'Detail').controls.find((c: { id: string }) => c.id === 'test-label');
  assert.equal(control.text, 'After');
  assert.deepEqual(control.style, { fontSize: 8, color: '#222222' });
  const beforeFailedBatch = fs.readFileSync(layoutFile, 'utf8');
  const failed = await client.callTool({ name: 'batch_update_controls', arguments: { updates: [
    { bandId: 'Detail', controlId: 'test-label', patch: { text: 'Must roll back' } },
    { bandId: 'Detail', controlId: 'missing', patch: { text: 'No target' } },
  ] } });
  assert.equal(failed.isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), beforeFailedBatch);
  const invalid = await client.callTool({ name: 'set_band_height', arguments: { bandId: 'Detail', height: -1 } });
  assert.equal(invalid.isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), beforeFailedBatch);
  await call('update_control', {
    subReportControlId: 'ctl-subreport-serials', bandId: 'sub-band-detail', controlId: 'sub-td-qc', patch: { style: { color: '#123456' } },
  });
  layout = await read();
  const sub = layout.report.bands.flatMap((b: { controls: { id: string }[] }) => b.controls).find((c: { id: string }) => c.id === 'ctl-subreport-serials');
  assert.equal(sub.subReportDefinition.bands.find((b: { id: string }) => b.id === 'sub-band-detail').controls.find((c: { id: string }) => c.id === 'sub-td-qc').style.color, '#123456');
  await call('delete_control', { bandId: 'Detail', controlId: 'test-label' });
  const originalFields = (await read()).report.calculatedFields;
  const agentFields = [
    { name: 'agentLine', scope: 'row', type: 'number', expression: '=quantity * unitPrice' },
    { name: 'agentSubtotal', scope: 'report', type: 'number', expression: '=SUM(calc.agentLine)' },
    { name: 'agentTax', scope: 'report', type: 'number', expression: '=ROUND(calc.agentSubtotal * params.taxRate, 2)' },
    { name: 'agentTotal', scope: 'report', type: 'number', expression: '=calc.agentSubtotal + calc.agentTax' },
  ];
  await call('set_calculated_fields', { calculatedFields: [...originalFields, ...agentFields] });
  const fieldsReply = await call('get_available_data_fields');
  assert.ok(JSON.parse((fieldsReply.content as { text: string }[])[0].text).calculatedFields.some((f: { name: string }) => f.name === 'agentTotal'));
  const preview = await call('preview_formula', { expression: '=calc.agentTotal', data: [{ quantity: 2, unitPrice: 10.4 }, { quantity: 1, unitPrice: 10.4 }], parameters: { taxRate: 0.05 }, formatString: 'N2' });
  const previewResult = JSON.parse((preview.content as { text: string }[])[0].text);
  assert.equal(previewResult.value, 32.76);
  assert.equal(previewResult.formatted, '32.76');
  const childPreview = await call('preview_formula', { expression: '=LEN(serialNo)', scope: 'row', subReportControlId: 'ctl-subreport-serials', data: [{ serials: [{ serialNo: '甲😀乙' }] }] });
  assert.equal(JSON.parse((childPreview.content as { text: string }[])[0].text).value, 3);
  const validReply = await call('validate_report_formulas', { execute: true });
  assert.equal(JSON.parse((validReply.content as { text: string }[])[0].text).valid, true);
  const beforeCycle = fs.readFileSync(layoutFile, 'utf8');
  const cycle = await client.callTool({ name: 'set_calculated_fields', arguments: { calculatedFields: [...originalFields, ...agentFields.map(f => f.name === 'agentTax' ? { ...f, expression: '=calc.agentTotal' } : f)] } });
  assert.equal(cycle.isError, true);
  assert.match(JSON.stringify(cycle.content), /CIRCULAR_REFERENCE/);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), beforeCycle);
  await call('export_pdf', { outputPath: path.join(temporary.directory, 'empty.pdf'), recordCount: 0 });
  await call('export_pdf', { outputPath: path.join(temporary.directory, 'two.pdf'), recordCount: 2 });
  const empty = fs.readFileSync(path.join(temporary.directory, 'empty.pdf'));
  const two = fs.readFileSync(path.join(temporary.directory, 'two.pdf'));
  assert.equal(two.subarray(0, 5).toString(), '%PDF-');
  assert.ok(two.length > empty.length, 'recordCount must change the compiled output');
  const detail = (await read()).report.bands.find((b: { type: string }) => b.type === 'Detail');
  await call('update_control', { bandId: 'Detail', controlId: detail.controls.find((c: { type: string }) => c.type === 'Field').id, patch: { type: 'Expression', expression: '=1 / (quantity - quantity)' } });
  const blocked = await client.callTool({ name: 'export_pdf', arguments: { outputPath: path.join(temporary.directory, 'two.pdf'), recordCount: 2 } });
  assert.equal(blocked.isError, true);
  assert.match(JSON.stringify(blocked.content), /DIVISION_BY_ZERO/);
  assert.deepEqual(fs.readFileSync(path.join(temporary.directory, 'two.pdf')), two);
  const invalidReport = await client.callTool({ name: 'set_full_report', arguments: { report: { bands: [] } } });
  assert.equal(invalidReport.isError, true);
  const customSource = { id: 'custom', name: 'External invoice', schema: {
    parameters: [{ name: 'customer', label: 'Customer', type: 'string' }], detailFields: [{ name: 'price', label: 'Price', type: 'number', nullable: false }],
  }, data: { parameters: { customer: 'CUSTOM-CUSTOMER' }, items: [{ price: 12.5 }, { price: 7.5 }] } };
  const customReport = { id: 'external', name: 'External', pageSettings: layout.report.pageSettings, bands: [{ id: 'detail', type: 'Detail', height: 24,
    controls: [{ id: 'price', type: 'Field', x: 0, y: 0, width: 100, height: 20, fieldName: 'price' }] }] };
  await call('set_report_data_source', { dataSource: customSource, report: customReport });
  const savedSource = JSON.parse(((await call('get_report_data_source')).content as { text: string }[])[0].text);
  assert.deepEqual(savedSource.dataSource, customSource);
  const discovered = JSON.parse(((await call('get_available_data_fields')).content as { text: string }[])[0].text);
  assert.equal(discovered.dataSourceId, 'custom'); assert.equal(discovered.sampleDetailRecord.price, 12.5);
  assert.deepEqual(discovered.detailFields.map((f: { name: string }) => f.name), ['price']);
  const savedPreview = JSON.parse(((await call('preview_formula', { expression: '=SUM(price)' })).content as { text: string }[])[0].text);
  assert.equal(savedPreview.value, 20);
  const customBefore = fs.readFileSync(layoutFile, 'utf8');
  assert.equal((await client.callTool({ name: 'set_report_data_source', arguments: { dataSource: { ...customSource, schema: { detailFields: [] } } } })).isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), customBefore);
  assert.equal((await client.callTool({ name: 'set_report_data_source', arguments: { dataSource: { ...customSource, data: { items: [{ price: 'invalid' }] } } } })).isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), customBefore);
  await call('export_pdf', { outputPath: path.join(temporary.directory, 'custom.pdf') });
  const customPdf = getDocument({ data: new Uint8Array(fs.readFileSync(path.join(temporary.directory, 'custom.pdf'))) });
  const pdfDocument = await customPdf.promise;
  assert.equal(pdfDocument.numPages, 1);
  const pdfText = (await (await pdfDocument.getPage(1)).getTextContent()).items.filter(item => 'str' in item).map(item => item.str).join(' ');
  assert.match(pdfText, /12\.5/); assert.match(pdfText, /7\.5/);
  await customPdf.destroy();
  // Formula execution, schema discovery and PDF all use the persisted custom rows.
  fs.writeFileSync(layoutFile, '{corrupt');
  assert.equal((await client.callTool({ name: 'get_report_layout', arguments: {} })).isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), '{corrupt');
  await call('reset_report_layout');
  assert.equal((await read()).report.id, layout.report.id);
  console.log('MCP integration passed: 22 tools, formula discovery, dependency chains, child preview, atomic rejection, recovery and guarded PDF export.');
} catch (error) {
  console.error(stderr);
  throw error;
} finally {
  await client.close();
  temporary.cleanup();
}
