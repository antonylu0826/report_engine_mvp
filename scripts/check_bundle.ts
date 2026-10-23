import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(projectRoot, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(output, '.vite/manifest.json'), 'utf8')) as Record<string, {
  file: string;
  isEntry?: boolean;
  imports?: string[];
}>;
const chunks = fs.readdirSync(path.join(output, 'assets')).filter(file => file.endsWith('.js'))
  .map(file => ({ file, bytes: fs.statSync(path.join(output, 'assets', file)).size }));
assert.ok(chunks.length > 0, 'Build did not emit any JavaScript');
for (const chunk of chunks) assert.ok(chunk.bytes <= 500_000,
  `${chunk.file} exceeds the default 500 kB chunk budget (${chunk.bytes} bytes)`);

const initial = new Set<string>();
function visit(key: string) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const dependency of manifest[key].imports ?? []) visit(dependency);
}
for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
assert.ok(initial.size > 0, 'Build manifest has no entry point');
for (const key of initial) assert.ok(!/^(?:pdf-|react-pdf\.)/.test(path.basename(manifest[key].file)),
  `PDF dependency is eagerly loaded by the designer: ${manifest[key].file}`);
assert.ok(!initial.has('src/compiler/pdfCompiler.tsx'), 'PDF compiler must remain lazy');
assert.ok(!initial.has('src/components/viewer/ReportViewer.tsx'), 'PDF viewer must remain lazy');
const initialBytes = [...initial].reduce((sum, key) => sum + fs.statSync(path.join(output, manifest[key].file)).size, 0);
assert.ok(initialBytes <= 650_000, `Initial JavaScript exceeds 650 kB (${initialBytes} bytes)`);
const largest = Math.max(...chunks.map(chunk => chunk.bytes));
console.log(`Bundle budget passed: largest chunk ${(largest / 1000).toFixed(2)} kB; initial JS ${(initialBytes / 1000).toFixed(2)} kB; PDF renders on the backend.`);
