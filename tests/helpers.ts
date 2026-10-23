import fs from 'node:fs';
import path from 'node:path';
import type { ReportDefinition, ControlDefinition } from '../src/types/report';

export function temporaryDirectory() {
  const root = path.resolve('scratch');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'report-engine-tests-'));
  return {
    directory,
    cleanup() {
      const relative = path.relative(root, path.resolve(directory));
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe test cleanup path');
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function label(patch: Partial<ControlDefinition> = {}): ControlDefinition {
  return { id: 'label', type: 'Label', x: 0, y: 0, width: 100, height: 16, text: 'Example', ...patch };
}

export function reportFixture(): ReportDefinition {
  return {
    id: 'test-report', name: 'Test report',
    pageSettings: { size: 'A4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
    bands: [{ id: 'detail', type: 'Detail', height: 30, controls: [label()] }],
  };
}
