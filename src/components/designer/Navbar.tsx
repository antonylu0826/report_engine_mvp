import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Eye,
  Code2,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Sparkles,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import { pdf } from '@react-pdf/renderer';
import { ReportPDFDocument } from '@/compiler/pdfCompiler';

export const Navbar: React.FC = () => {
  const {
    report,
    dataSource,
    data,
    activeTab,
    setActiveTab,
    zoom,
    setZoom,
    resetToSample,
    setReport,
  } = useReportStore();

  const [isExporting, setIsExporting] = useState(false);
  const [mcpSynced, setMcpSynced] = useState(false);
  const [mcpConnecting, setMcpConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastMtimeRef = useRef<number>(0);
  const isRemoteUpdatingRef = useRef<boolean>(false);
  const isFirstMountRef = useRef<boolean>(true);

  // Sync with current_report_layout.json from MCP (Inbound: Disk -> UI)
  const fetchMcpLayout = async (force = false) => {
    try {
      setMcpConnecting(true);
      const res = await fetch('/api/report-layout');
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.report) {
        if (force || json.mtime !== lastMtimeRef.current) {
          lastMtimeRef.current = json.mtime;
          isRemoteUpdatingRef.current = true;
          setReport(json.report);
          setMcpSynced(true);
          setTimeout(() => setMcpSynced(false), 2500);
        }
      }
    } catch {
      // ignore offline or static build
    } finally {
      setMcpConnecting(false);
    }
  };

  // Poll for changes made by external MCP Agent every 1.5 seconds
  useEffect(() => {
    fetchMcpLayout(true); // initial fetch

    const timer = setInterval(() => {
      fetchMcpLayout(false);
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Outbound: Push UI edits to current_report_layout.json (Debounced ~500ms)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    if (isRemoteUpdatingRef.current) {
      isRemoteUpdatingRef.current = false;
      return;
    }

    const saveTimer = setTimeout(async () => {
      try {
        setIsSaving(true);
        const res = await fetch('/api/report-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.mtime) {
            lastMtimeRef.current = json.mtime;
          }
          setMcpSynced(true);
          setTimeout(() => setMcpSynced(false), 1500);
        }
      } catch (err) {
        console.error('Failed to sync report to disk:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(saveTimer);
  }, [report]);

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const doc = <ReportPDFDocument report={report} data={data} dataSource={dataSource} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.name || 'report'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('產生 PDF 失敗，請檢查控制台錯誤訊息。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="h-13 border-b border-slate-200 bg-white/95 backdrop-blur px-4 flex items-center justify-between z-30 select-none dark:border-slate-800 dark:bg-slate-950/90">
      {/* Brand & Document Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-900 text-white shadow-sm dark:bg-slate-50 dark:text-slate-900">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              {report.name}
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {report.pageSettings.size} • {report.pageSettings.orientation === 'portrait' ? '直向' : '橫向'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            企業級報表引擎
          </p>
        </div>
      </div>

      {/* Center Tabs: Mode Switcher */}
      <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('designer')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'designer'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>報表設計</span>
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'preview'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>即時預覽</span>
        </button>

        <button
          onClick={() => setActiveTab('agent')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'agent'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          <span>智慧助理</span>
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeTab === 'schema'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>規格定義</span>
        </button>
      </div>

      {/* Right Controls: MCP Status, Zoom & Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* MCP Live Sync Status Pill */}
        <button
          onClick={() => fetchMcpLayout(true)}
          className={`flex items-center space-x-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all ${
            isSaving
              ? 'bg-amber-500/10 text-amber-600 border-amber-400/40 dark:text-amber-400'
              : mcpSynced
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-400/40 dark:text-emerald-400 animate-pulse'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
          }`}
          title="自動雙向同步（UI 編輯自動存盤，外部 Agent 修改即時推播），點擊可手動強制重新拉取"
        >
          <Radio className={`h-3 w-3 ${isSaving ? 'text-amber-500 animate-spin' : mcpSynced ? 'text-emerald-500' : 'text-blue-500 animate-pulse'}`} />
          <span>{isSaving ? '同步至磁碟中...' : mcpSynced ? '雙向已同步' : 'MCP 即時連動'}</span>
          <RefreshCw className={`h-2.5 w-2.5 ml-0.5 ${mcpConnecting || isSaving ? 'animate-spin' : ''}`} />
        </button>

        {activeTab === 'designer' && (
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 dark:bg-slate-900 dark:border-slate-800">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              title="縮小"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-600 w-10 text-center dark:text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(Math.min(1.8, zoom + 0.1))}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              title="放大"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={resetToSample}
          className="text-xs h-8 space-x-1.5"
          title="重設為預設範例"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>重設範本</span>
        </Button>

        <Button
          size="sm"
          onClick={handleExportPDF}
          disabled={isExporting}
          className="text-xs h-8 space-x-1.5 bg-slate-900 text-white hover:bg-slate-800 shadow-sm dark:bg-slate-100 dark:text-slate-900"
        >
          {isExporting ? (
            <span className="inline-block animate-spin mr-1">⏳</span>
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>{isExporting ? '算繪中...' : '匯出 PDF'}</span>
        </Button>
      </div>
    </header>
  );
};
