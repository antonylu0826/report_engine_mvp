import { useEffect, useState } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { requestReportPdf } from '@/client/reportPdf';
import { sampleOrderData14, sampleOrderData45, sampleOrderData100 } from '@/mock/sampleReport';
import { useCurrentLocale } from '@/i18n';

export function ReportViewer() {
  const { report, dataSource, data, setData } = useReportStore();
  const { locale } = useCurrentLocale();
  const zh = locale === 'zh-TW';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ report: typeof report; data: typeof data; dataSource: typeof dataSource; revision: number; url?: string; error?: string }>();
  useEffect(() => {
    let active = true, url: string | undefined;
    void requestReportPdf(report, data, dataSource).then(blob => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setState({ report, data, dataSource, revision, url });
    }).catch(error => {
      if (active) setState({ report, data, dataSource, revision, error: error.message });
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [report, data, dataSource, revision]);
  // Hide previous output synchronously when any input changes; an old PDF must never look current.
  const current = state?.report === report && state?.data === data && state?.dataSource === dataSource && state?.revision === revision ? state : undefined;
  const refresh = () => { void requestReportPdf(report, data, dataSource, true).catch(() => {}); setRevision(v => v + 1); };
  return <div className="flex-1 flex flex-col h-[calc(100vh-3.25rem)] bg-slate-950 text-slate-200">
    <div className="flex items-center justify-between gap-3 p-2 border-b border-slate-700 text-xs">
      <span>{zh ? 'PDF 預覽' : 'PDF Preview'}</span>
      <div className="flex items-center gap-2">
        {[sampleOrderData14, sampleOrderData45, sampleOrderData100].map(rows => <button key={rows.length} onClick={() => setData(rows)} className={`rounded px-3 py-1 ${data.length === rows.length ? 'bg-blue-600' : 'bg-slate-800'}`}>{rows.length} {zh ? '筆' : 'rows'}</button>)}
        <button onClick={refresh} className="rounded px-3 py-1 bg-slate-800">{zh ? '重新產生' : 'Refresh'}</button>
        {current?.url && <a href={current.url} download={`${report.name || 'report'}.pdf`} className="rounded px-3 py-1 bg-blue-600">{zh ? '下載 PDF' : 'Download PDF'}</a>}
      </div>
    </div>
    {current?.error ? <div role="alert" className="m-6 p-4 max-h-[70vh] overflow-auto rounded border border-red-800 text-red-300 whitespace-pre-wrap text-sm">{current.error}</div>
      : current?.url ? <iframe src={`${current.url}#toolbar=1&navpanes=0`} title="PDF Preview" className="flex-1 w-full border-none" />
      : <div role="status" className="m-auto text-sm text-slate-400">{zh ? '正在產生 PDF…' : 'Generating PDF…'}</div>}
  </div>;
}
