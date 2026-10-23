import { useState } from 'react';
import type { ControlDefinition } from '@/types/report';
import { patchControl } from '@/report/operations';
import { validateReportFormulas } from '@/formula/report';
import { FormulaEditor } from './FormulaEditor';
import { useFormulaData } from './useFormulaData';
import { useCurrentLocale } from '@/i18n';

export function ControlFormulaEditor({ control, bandId, onUpdate }: { control: ControlDefinition; bandId: string; onUpdate: (patch: Partial<ControlDefinition>) => void }) {
  const { report, schema, data, parameters } = useFormulaData();
  const { locale } = useCurrentLocale(), zh = locale === 'zh-TW';
  const [buffer, setBuffer] = useState(() => ({ base: control.expression ?? '', value: control.expression ?? '' }));
  const dirty = buffer.value !== buffer.base;
  const value = dirty ? buffer.value : control.expression ?? '';
  const conflict = dirty && buffer.base !== (control.expression ?? '');
  const setValue = (value: string) => setBuffer(current => ({ base: dirty ? current.base : control.expression ?? '', value }));
  const band = report.bands.find(b => b.id === bandId)!;
  const candidate = patchControl(report, bandId, control.id, { expression: value });
  const validation = validateReportFormulas(candidate, { schema });
  const scope = band.type === 'Detail' ? 'row' : band.type.startsWith('Group') ? 'group' : 'report';
  return <div className="space-y-2">
    {conflict && <p role="alert" className="text-amber-700 text-xs">{zh ? '公式已由其他編輯更新，目前輸入已保留。可按還原輸入載入新版。' : 'The saved formula changed. Your input is preserved; reset input to load the new version.'}</p>}
    <FormulaEditor value={value} onChange={setValue} report={candidate} schema={schema} data={data} parameters={parameters} scope={scope} allowRow={scope === 'group'} formatString={control.formatString} />
    {validation.diagnostics.map((d, i) => <div key={i} className="text-xs text-red-600 break-all">{d.message}</div>)}
    <button type="button" disabled={!validation.valid || conflict || value === control.expression} onClick={() => { onUpdate({ expression: value }); setBuffer({ base: value, value }); }} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-40">{zh ? '套用公式' : 'Apply formula'}</button>
    <button type="button" onClick={() => setBuffer({ base: control.expression ?? '', value: control.expression ?? '' })} className="ml-2 text-xs text-slate-500">{zh ? '還原輸入' : 'Reset input'}</button>
  </div>;
}
