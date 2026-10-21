import React, { useState, useEffect } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import { Copy, Check, Save } from 'lucide-react';

export const SchemaViewer: React.FC = () => {
  const { report, setReport } = useReportStore();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setJsonText(JSON.stringify(report, null, 2));
    setError(null);
  }, [report]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.bands || !Array.isArray(parsed.bands)) {
        throw new Error('Schema 格式無效：缺少 bands 陣列。');
      }
      setReport(parsed);
      setError(null);
      alert('Schema 已成功套用！');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.25rem)] bg-slate-950 text-slate-100 select-none">
      {/* Schema Toolbar */}
      <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-200">報表定義結構</span>
          <span className="text-[11px] text-slate-400">
            • 宣告式報表結構 • 可持久化至資料庫
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {error && <span className="text-red-400 text-xs">{error}</span>}

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 space-x-1"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? '已複製' : '複製定義'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleApply}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white space-x-1"
          >
            <Save className="h-3 w-3" />
            <span>套用變更</span>
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
