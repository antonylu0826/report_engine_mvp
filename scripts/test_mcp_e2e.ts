import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
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
  assert.equal((await client.listTools()).tools.length, 13);
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
  await call('export_pdf', { outputPath: path.join(temporary.directory, 'empty.pdf'), recordCount: 0 });
  await call('export_pdf', { outputPath: path.join(temporary.directory, 'two.pdf'), recordCount: 2 });
  const empty = fs.readFileSync(path.join(temporary.directory, 'empty.pdf'));
  const two = fs.readFileSync(path.join(temporary.directory, 'two.pdf'));
  assert.equal(two.subarray(0, 5).toString(), '%PDF-');
  assert.ok(two.length > empty.length, 'recordCount must change the compiled output');
  const invalidReport = await client.callTool({ name: 'set_full_report', arguments: { report: { bands: [] } } });
  assert.equal(invalidReport.isError, true);
  fs.writeFileSync(layoutFile, '{corrupt');
  assert.equal((await client.callTool({ name: 'get_report_layout', arguments: {} })).isError, true);
  assert.equal(fs.readFileSync(layoutFile, 'utf8'), '{corrupt');
  await call('reset_report_layout');
  assert.equal((await read()).report.id, layout.report.id);
  console.log('MCP integration passed: 13 tools, nested updates, atomic batches, validation, recovery and real PDF export.');
} catch (error) {
  console.error(stderr);
  throw error;
} finally {
  await client.close();
  temporary.cleanup();
}
