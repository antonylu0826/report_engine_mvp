import { useState } from 'react';
import type { CalculatedField } from '@/types/report';
import { parseReport } from '@/report/schema';
import { validateReportFormulas } from '@/formula/report';
import { FormulaEditor } from './FormulaEditor';
import { useFormulaData } from './useFormulaData';
import { useCurrentLocale } from '@/i18n';

export function CalculatedFieldsPanel() {
  const { state, report, schema, data, parameters } = useFormulaData();
  const { locale } = useCurrentLocale(), zh = locale === 'zh-TW';
  const [draft, setDraft] = useState(() => ({ fields: report.calculatedFields ?? [], base: JSON.stringify(report.calculatedFields ?? []) }));
  const [selected, setSelected] = useState(0), [saveError, setSaveError] = useState('');
  const candidate = { ...report, calculatedFields: draft.fields };
  const validation = validateReportFormulas(candidate, { schema });
  const shape = (() => { try { parseReport(candidate); return ''; } catch (error) { return error instanceof Error ? error.message : String(error); } })();
  const externalChange = JSON.stringify(report.calculatedFields ?? []) !== draft.base;
  const selectedField = draft.fields[selected];
  const patch = (patch: Partial<CalculatedField>) => setDraft(d => ({ ...d, fields: d.fields.map((f, i) => i === selected ? { ...f, ...patch } : f) }));
  const save = () => {
    try {
      parseReport(candidate);
      if (!validation.valid || externalChange || shape) return;
      state.updateActiveReport(active => ({ ...active, calculatedFields: draft.fields }));
      setDraft(d => ({ ...d, base: JSON.stringify(d.fields) })); setSaveError('');
    } catch (error) { setSaveError(error instanceof Error ? error.message : String(error)); }
  };
  const add = () => {
    let i = 1; while (draft.fields.some(f => f.name === `calculation${i}`)) i++;
    setSelected(draft.fields.length);
    setDraft(d => ({ ...d, fields: [...d.fields, { name: `calculation${i}`, type: 'number', scope: 'row', expression: '=0' }] }));
  };
  return <div className="flex-1 h-full min-h-0 overflow-auto bg-slate-50 p-5 dark:bg-slate-950">
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="font-semibold">{zh ? '計算欄位' : 'Calculated fields'} · {report.name}</h1><p className="text-xs text-slate-500 mt-1">{zh ? '編輯名稱、作用域及公式，驗證後一次套用。儲存立即生效。' : 'Edit names, scope and formulas. Apply the validated collection together.'}</p></div>
        <div className="flex gap-2 text-xs"><button onClick={add} className="border rounded px-3 py-2">{zh ? '新增欄位' : 'Add field'}</button><button disabled={!validation.valid || externalChange || !!shape} onClick={save} className="rounded bg-blue-600 text-white px-3 py-2 disabled:opacity-40">{zh ? '套用計算欄位' : 'Apply fields'}</button><button onClick={() => state.setActiveTab('designer')} className="border rounded px-3 py-2">{zh ? '回設計器' : 'Designer'}</button></div>
      </div>
      {externalChange && <div role="alert" className="text-amber-700 text-sm">{zh ? '已儲存的計算欄位有變更，目前輸入已保留。' : 'Saved calculations changed; your input is preserved.'}<button className="underline ml-3" onClick={() => { setDraft({ fields: report.calculatedFields ?? [], base: JSON.stringify(report.calculatedFields ?? []) }); setSelected(0); }}>{zh ? '捨棄輸入並重新載入' : 'Discard input and reload'}</button></div>}
      {shape && <p role="alert" className="text-xs text-red-600 whitespace-pre-wrap">{shape}</p>}
      <div className="grid grid-cols-[220px_1fr] gap-4">
        <div className="space-y-1">{draft.fields.map((f, i) => <button key={i} onClick={() => setSelected(i)} className={`w-full text-left rounded border px-3 py-2 text-xs ${selected === i ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-slate-200 dark:border-slate-800'}`}><div className="font-mono truncate">calc.{f.name}</div><div className="text-slate-500 mt-1">{f.scope} · {f.type}</div></button>)}{!draft.fields.length && <p className="text-xs text-slate-500">{zh ? '尚無計算欄位，可先新增一個。' : 'Add a calculated field to begin.'}</p>}</div>
        {selectedField && <div className="rounded border border-slate-200 bg-white p-4 space-y-3 dark:bg-slate-900 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <label>{zh ? '名稱' : 'Name'}<input aria-label="Calculation name" value={selectedField.name} onChange={e => patch({ name: e.target.value })} className="mt-1 w-full border rounded p-2 dark:bg-slate-950" /></label>
            <label>{zh ? '作用域' : 'Scope'}<select aria-label="Calculation scope" value={selectedField.scope} onChange={e => patch({ scope: e.target.value as CalculatedField['scope'] })} className="mt-1 w-full border rounded p-2 dark:bg-slate-950">{['row', 'group', 'report'].map(v => <option key={v}>{v}</option>)}</select></label>
            <label>{zh ? '型別' : 'Type'}<select aria-label="Calculation type" value={selectedField.type} onChange={e => patch({ type: e.target.value as CalculatedField['type'] })} className="mt-1 w-full border rounded p-2 dark:bg-slate-950">{['number', 'string', 'boolean', 'date', 'datetime'].map(v => <option key={v}>{v}</option>)}</select></label>
          </div>
          <FormulaEditor value={selectedField.expression} onChange={expression => patch({ expression })} report={candidate} schema={schema} data={data} parameters={parameters} scope={selectedField.scope} />
          <button className="text-xs text-red-600" onClick={() => { setDraft(d => ({ ...d, fields: d.fields.filter((_, i) => i !== selected) })); setSelected(0); }}>{zh ? '刪除此計算欄位' : 'Delete this field'}</button>
        </div>}
      </div>
      <div className="text-xs space-y-1 break-all" role="status">{validation.valid ? <p className="text-emerald-700">{zh ? '靜態驗證通過。計算順序：' : 'Validated. Dependency order: '}{validation.dependencyOrder.$?.join(' → ') || '—'}</p> : validation.diagnostics.map((d, i) => <p key={i} className="text-red-600">{d.path}: {d.message}</p>)}{saveError && <p className="text-red-600">{saveError}</p>}</div>
    </div>
  </div>;
}
