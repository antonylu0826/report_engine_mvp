import React from 'react';
import { usePDF } from '@react-pdf/renderer';
import { useReportStore } from '@/store/useReportStore';
import { ReportPDFDocument } from '@/compiler/pdfCompiler';
import { Download, RefreshCw, AlertCircle, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  sampleOrderData14,
  sampleOrderData45,
  sampleOrderData100,
} from '@/mock/sampleReport';

export const ReportViewer: React.FC = () => {
  const { report, dataSource, data, setData } = useReportStore();

  const [instance, updateInstance] = usePDF({
    document: <ReportPDFDocument report={report} data={data} dataSource={dataSource} />,
  });

  // Re-trigger update when report, dataSource, or data changes
  React.useEffect(() => {
    updateInstance(<ReportPDFDocument report={report} data={data} dataSource={dataSource} />);
  }, [report, dataSource, data, updateInstance]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.25rem)] bg-slate-900 select-none">
      {/* Viewer Toolbar */}
      <div className="h-10 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-200">即時 PDF 預覽</span>
            <span className="text-[11px] text-slate-400">
              • 繁體中文向量引擎
            </span>
          </div>

          {/* Dataset Size Switcher */}
          <div className="flex items-center space-x-1 bg-slate-900/80 p-0.5 rounded-md border border-slate-700">
            <span className="text-[10px] text-slate-400 px-1.5 flex items-center space-x-1">
              <Database className="h-3 w-3 text-slate-500" />
              <span>資料筆數:</span>
            </span>
            <button
              onClick={() => setData(sampleOrderData14)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                data.length === 14
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              14 筆 (單頁)
            </button>
            <button
              onClick={() => setData(sampleOrderData45)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                data.length === 45
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              45 筆 (2頁跨頁)
            </button>
            <button
              onClick={() => setData(sampleOrderData100)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                data.length === 100
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              100 筆 (多頁大表)
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateInstance(<ReportPDFDocument report={report} data={data} />)}
            className="text-slate-300 hover:text-white hover:bg-slate-700 h-7 text-xs space-x-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>重新整理</span>
          </Button>

          {instance.url && (
            <a
              href={instance.url}
              download={`${report.name || 'report'}.pdf`}
              className="inline-flex items-center space-x-1.5 h-7 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Download className="h-3 w-3" />
              <span>下載 PDF</span>
            </a>
          )}
        </div>
      </div>

      {/* PDF Viewer Body */}
      <div className="flex-1 w-full h-full bg-slate-950 flex justify-center items-center relative overflow-hidden">
        {instance.loading && (
          <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-xs">正在編譯並算繪 {data.length} 筆資料之 PDF 報表...</span>
          </div>
        )}

        {instance.error && (
          <div className="p-4 max-w-md bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-xs flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm mb-1">PDF 算繪失敗</div>
              <div className="font-mono text-[11px] text-red-300 break-all">
                {String(instance.error)}
              </div>
            </div>
          </div>
        )}

        {!instance.loading && !instance.error && instance.url && (
          <iframe
            src={`${instance.url}#toolbar=1&navpanes=0`}
            title="PDF Preview"
            className="w-full h-full border-none"
          />
        )}
      </div>
    </div>
  );
};
