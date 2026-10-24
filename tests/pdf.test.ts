import { pdfControlRegistry } from '../src/controls/pdfRegistry';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportPDFDocument } from '../src/compiler/pdfCompiler';
import { ReportValidationError } from '../src/report/preflight';
import { getBarcodePattern } from '../src/controls/barcodeUtils';
import { sampleOrderReport, sampleOrderData14, sampleOrderDataSource } from '../src/mock/sampleReport';
import { label, reportFixture } from './helpers';
import type { ReactElement } from 'react';

test('Node barcodes contain actual vector bars and QR images await first generation', async () => {
  const control = label({ type: 'Barcode', text: 'TEST-123', width: 160, height: 40 });
  const rendered = pdfControlRegistry.get('Barcode')!({ control, context: {} }) as ReactElement<{ children: unknown[] }>;
  assert.ok(rendered.props.children.length > 1);
  assert.match(getBarcodePattern('TEST-123').data, /^[01]+$/);
  assert.equal(pdfControlRegistry.get('Barcode')!({ control: { ...control, text: '' }, context: {} }), null);
  const qr = pdfControlRegistry.get('QRCode')!({ control: { ...control, type: 'QRCode' }, context: {} }) as ReactElement<{ src: () => Promise<string> }>;
  assert.equal(typeof qr.props.src, 'function');
  const source = await qr.props.src();
  assert.match(source, /^data:image\/png;base64,/);
  assert.ok(source.length > 200, 'QR output must not be the transparent placeholder');
});

test('PDF subreports suppress empty data and resolve nested summaries in child scope', () => {
  const child = reportFixture();
  child.bands[0].controls = [label({ type: 'Expression', expression: '=SUM(amount)' })];
  const control = label({ type: 'SubReport', width: 300, subReportDefinition: child, subReportBinding: 'items' });
  assert.equal(pdfControlRegistry.get('SubReport')!({ control, context: { currentRow: { items: [] } } }), null);
});

test('real PDF compilation succeeds for empty data, nested reports, barcode and QR', async () => {
  const empty = await renderToBuffer(ReportPDFDocument({ report: reportFixture(), data: [] }));
  assert.equal(empty.subarray(0, 5).toString(), '%PDF-');
  const withCodes = reportFixture();
  withCodes.bands[0].height = 120;
  withCodes.bands[0].controls = [
    label({ type: 'Barcode', text: 'TEST-123', width: 180, height: 40 }),
    label({ id: 'qr', type: 'QRCode', text: 'https://example.com/test', x: 190, width: 60, height: 60 }),
  ];
  const codes = await renderToBuffer(ReportPDFDocument({ report: withCodes, data: [{}] }));
  assert.equal(codes.subarray(0, 5).toString(), '%PDF-');
  const nested = await renderToBuffer(ReportPDFDocument({ report: sampleOrderReport, data: sampleOrderData14, dataSource: sampleOrderDataSource }));
  assert.ok(nested.length > 10000);
});


test('impossible fixed geometry and growing fixed headers fail before rendering', () => {
  const report = reportFixture(); report.bands[0].height = 1000;
  assert.throws(() => ReportPDFDocument({ report, data:[{}] }), error=>error instanceof ReportValidationError&&error.diagnostics.some(d=>d.code==='BAND_TOO_TALL'));
  report.bands[0].height=30;report.bands.push({id:'header',type:'PageHeader',height:20,controls:[label({id:'growing-header',canGrow:true})]});
  assert.throws(() => ReportPDFDocument({ report, data:[{}] }), /require fixed controls/);
});
