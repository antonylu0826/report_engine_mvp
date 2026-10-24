import React, { useState, useEffect, useRef } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import { Copy, Check, Save } from 'lucide-react';
import { useCurrentLocale } from '@/i18n';
import { parseReport } from '@/report/schema';
import { assertReportFormulas } from '@/formula/report';

export const SchemaViewer: React.FC = () => {
  const { locale } = useCurrentLocale();
  const { report, setReport, dataSource } = useReportStore();
  const [jsonText, setJsonText] = useState(() => JSON.stringify(report, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const prevReportRef = useRef(report);

  // Sync external report changes safely without setState-in-effect cascading render warning
  useEffect(() => {
    if (prevReportRef.current !== report) {
      prevReportRef.current = report;
      queueMicrotask(() => {
        setJsonText(JSON.stringify(report, null, 2));
        setError(null);
      });
    }
  }, [report]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    try {
      const parsed = parseReport(JSON.parse(jsonText));
      assertReportFormulas(parsed, dataSource.schema);
      if (!parsed.bands || !Array.isArray(parsed.bands)) {
        throw new Error(
          locale === 'zh-TW'
            ? 'Schema 格式無效：缺少 bands 陣列。'
            : 'Invalid schema format: missing bands array.'
        );
      }
      setReport(parsed);
      setError(null);
      alert(locale === 'zh-TW' ? 'Schema 已成功套用！' : 'Schema successfully applied!');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 select-none">
      {/* Schema Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-200">
            {locale === 'zh-TW' ? '報表定義結構' : 'Report Schema Definition'}
          </span>
          <span className="text-[11px] text-slate-400">
            {locale === 'zh-TW'
              ? '• 宣告式報表結構 • 可持久化至資料庫'
              : '• Declarative Layout Spec • Database Persistable'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {error && <span className="text-red-400 text-xs">{error}</span>}

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 space-x-1 cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>
              {copied
                ? locale === 'zh-TW' ? '已複製' : 'Copied'
                : locale === 'zh-TW' ? '複製定義' : 'Copy Schema'}
            </span>
          </Button>

          <Button
            size="sm"
            onClick={handleApply}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white space-x-1 cursor-pointer"
          >
            <Save className="h-3 w-3" />
            <span>{locale === 'zh-TW' ? '套用變更' : 'Apply Changes'}</span>
          </Button>
        </div>
      </div>

      {/* Code Editor Area */}
      <div className="flex-1 p-4 overflow-hidden">
        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError(null);
          }}
          className="w-full h-full font-mono text-xs bg-slate-900/80 border border-slate-800 rounded-lg p-4 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none selection:bg-emerald-950"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
