import { useMemo, useRef, useState } from 'react';
import type { ReportDefinition } from '@/types/report';
import type { DataSourceSchema } from '@/types/datasource';
import type { FormulaContext, FormulaScope } from '@/formula/types';
import { FormulaError } from '@/formula/types';
import { getFormulaCatalog } from '@/formula/registry';
import { previewFormula } from '@/formula/report';
import { getReportGrouping, groupDataRows } from '@/compiler/grouping';
import { formatValue } from '@/compiler/formatters';
import { useCurrentLocale } from '@/i18n';
import { isRenderTemplate } from '@/formula/engine';

export interface FormulaEditorProps {
  value: string; onChange: (value: string) => void; report: ReportDefinition;
  schema: DataSourceSchema; data: Record<string, unknown>[]; parameters?: Record<string, unknown>;
  scope: FormulaScope; formatString?: string; allowRow?: boolean;
}
const catalog = getFormulaCatalog();
export function FormulaEditor(props: FormulaEditorProps) {
  const { locale } = useCurrentLocale(), zh = locale === 'zh-TW';
  const input = useRef<HTMLTextAreaElement>(null);
  const [selectedFunction, setSelectedFunction] = useState('IF');
  const [rowIndex, setRowIndex] = useState(0), [groupIndex, setGroupIndex] = useState(0);
  const [clock] = useState(() => new Date().toISOString());
  const grouping = getReportGrouping(props.report);
  const groups = useMemo(() => groupDataRows(props.data, grouping.field, grouping.sortOrder), [props.data, grouping.field, grouping.sortOrder]);
  const groupRows = props.scope === 'report' ? undefined : groups[groupIndex]?.rows;
  const context: FormulaContext = {
    schema: props.schema, dataSource: props.data, reportParameters: props.parameters, scope: props.scope,
    groupRows, currentRow: props.scope === 'row' || props.allowRow ? (groupRows ?? props.data)[rowIndex] : undefined,
    rowIndex, executionTime: clock, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  let result: ReturnType<typeof previewFormula> | undefined, error: FormulaError | undefined;
  const renderTemplate = isRenderTemplate(props.value);
  try { if (!renderTemplate) result = previewFormula(props.report, props.value, context); }
  catch (caught) { if (caught instanceof FormulaError) error = caught; else throw caught; }
  const functionSpec = catalog.functions.find(f => f.name === selectedFunction)!;
  const insert = (text: string) => {
    const start = input.current?.selectionStart ?? props.value.length, end = input.current?.selectionEnd ?? start;
    const prefix = props.value ? '' : '=';
    props.onChange(props.value.slice(0, start) + prefix + text + props.value.slice(end));
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + prefix.length + text.length, start + prefix.length + text.length); });
  };
  const fields = [
    ...(props.schema.detailFields.filter(f => f.type !== 'array').map(f => ({ reference: `row.${f.name}`, label: f.label, type: f.type }))),
    ...(props.schema.parameters ?? []).map(f => ({ reference: `params.${f.name}`, label: f.label, type: f.type })),
    ...(props.report.calculatedFields ?? []).map(f => ({ reference: `calc.${f.name}`, label: f.scope, type: f.type })),
  ];
  return <div className="space-y-2 text-xs">
    {renderTemplate && <p className="text-slate-500">{zh ? '頁碼與執行時間會在 PDF 排版時代入。' : 'Page numbers and execution time are substituted during PDF layout.'}</p>}
    <textarea ref={input} aria-label={zh ? '公式' : 'Formula'} value={props.value} onChange={e => props.onChange(e.target.value)} spellCheck={false}
      className="w-full min-h-24 rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:bg-slate-950 dark:border-slate-700" />
    <select aria-label={zh ? '插入欄位' : 'Insert field'} value="" onChange={e => insert(e.target.value)} className="w-full rounded border p-1.5 dark:bg-slate-900 dark:border-slate-700">
      <option value="">{zh ? '插入欄位／參數／計算欄位…' : 'Insert field / parameter / calculation…'}</option>
      {fields.map(f => <option key={f.reference} value={f.reference}>{f.reference} · {f.label} ({f.type})</option>)}
    </select>
    <div className="flex gap-2">
      <select aria-label={zh ? '函式' : 'Function'} value={selectedFunction} onChange={e => setSelectedFunction(e.target.value)} className="min-w-0 flex-1 rounded border p-1.5 dark:bg-slate-900 dark:border-slate-700">
        {catalog.functions.map(f => <option key={f.name}>{f.name}</option>)}
      </select>
      <button type="button" onClick={() => insert(`${selectedFunction}()`)} className="rounded bg-slate-200 px-2 dark:bg-slate-800">{zh ? '插入' : 'Insert'}</button>
    </div>
    <div className="rounded bg-slate-100 p-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300 space-y-1">
      <div className="font-mono break-all">{functionSpec.signature} → {functionSpec.returnType}</div>
      <div>{functionSpec.description}</div><div>{functionSpec.nullBehavior}</div>
      {functionSpec.examples.map(e => <button type="button" key={e.expression} onClick={() => props.onChange(e.expression)} className="block text-left font-mono text-blue-600 dark:text-blue-400 break-all" title={zh ? '套用範例' : 'Use example'}>{e.expression}</button>)}
    </div>
    <div className="flex gap-2 items-center">
      {props.scope !== 'report' && <label>{zh ? '群組' : 'Group'} <select aria-label="Sample group" value={groupIndex} onChange={e => { setGroupIndex(Number(e.target.value)); setRowIndex(0); }} className="border rounded p-1 dark:bg-slate-900">{groups.map((g, i) => <option key={i} value={i}>{g.key}</option>)}</select></label>}
      {(props.scope === 'row' || props.allowRow) && <label>{zh ? '資料列' : 'Row'} <input aria-label="Sample row" type="number" min={1} max={(groupRows ?? props.data).length || 1} value={rowIndex + 1} onChange={e => setRowIndex(Math.max(0, Number(e.target.value) - 1))} className="border rounded p-1 w-16 dark:bg-slate-900" /></label>}
    </div>
    {error ? <div role="alert" className="space-y-1 text-red-600 dark:text-red-400">{error.diagnostics.map((d, i) => <button type="button" key={i} className="block text-left break-all" onClick={() => { input.current?.focus(); if (d.span) input.current?.setSelectionRange(d.span.start, d.span.end); }}>{d.path ? `${d.path}: ` : ''}{d.message}{d.span ? ` [${d.span.start + 1}–${d.span.end}]` : ''}</button>)}</div>
      : result && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 break-all">
        <div>{zh ? '原始值' : 'Raw value'} ({result.type}): <code>{JSON.stringify(result.value)}</code></div>
        <div>{zh ? '格式化結果' : 'Formatted'}: {formatValue(result.value, props.formatString, context.timeZone)}</div>
      </div>}
  </div>;
}
