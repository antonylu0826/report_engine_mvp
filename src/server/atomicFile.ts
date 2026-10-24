import fs from 'node:fs';
interface ReplaceOptions {
  beforeReplace?: () => void;
  rename?: typeof fs.renameSync;
  pause?: (milliseconds: number) => void;
  platform?: NodeJS.Platform;
}
/** Retains atomic replacement; never removes the destination to work around a sharing violation. */
export function replaceFileAtomically(source: string, destination: string, options: ReplaceOptions = {}) {
  const rename = options.rename ?? fs.renameSync;
  const pause = options.pause ?? (milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds));
  const delays = [10, 20, 40, 80, 160];
  for (let attempt = 0; ; attempt++) {
    options.beforeReplace?.();
    try { rename(source, destination); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((options.platform ?? process.platform) !== 'win32' || !['EPERM','EACCES','EBUSY'].includes(code ?? '') || attempt === delays.length) throw error;
      pause(delays[attempt]);
    }
  }
}
