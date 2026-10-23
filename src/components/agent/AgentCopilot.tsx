import React, { useState, useEffect, useRef } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  CheckCircle2,
  Code2,
  Save,
  Copy,
  Check,
  Send,
  Zap,
  Layers,
  Ruler,
  FileCheck,
} from 'lucide-react';
import { parseReport } from '@/report/schema';
import { assertReportFormulas } from '@/formula/report';
import { getPageGeometry } from '@/report/geometry';
import { useCurrentLocale } from '@/i18n';

export const AgentCopilot: React.FC = () => {
  const { locale } = useCurrentLocale();
  const { report, setReport, updateControl, setActiveTab, resetToSample, dataSource } = useReportStore();
  const [jsonText, setJsonText] = useState(() => JSON.stringify(report, null, 2));
  const [copied, setCopied] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const prevReportRef = useRef(report);
  const [chatLogs, setChatLogs] = useState<
    { role: 'user' | 'agent'; text: string; action?: string }[]
  >([
    {
      role: 'agent',
      text:
        locale === 'zh-TW'
          ? '你好！我是像素級報表設計 Agent。我已載入完整的企業標準出貨單 Banded IR 模型。所有控制項具備精確的 X/Y 座標、寬高、邊框與樣式。請問您想如何微調或重新排版這張單據？'
          : 'Hello! I am the Pixel-Perfect Report Design Agent. I have loaded the Banded IR model with precise X/Y coordinates, dimensions, and styles. How would you like to refine the report layout?',
    },
  ]);

  // Sync JSON text when report changes in store safely without cascading render
  useEffect(() => {
    if (prevReportRef.current !== report) {
      prevReportRef.current = report;
      queueMicrotask(() => {
        setJsonText(JSON.stringify(report, null, 2));
      });
    }
  }, [report]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyJson = () => {
    try {
      const parsed = parseReport(JSON.parse(jsonText));
      assertReportFormulas(parsed, dataSource.schema);
      if (!parsed.bands || !Array.isArray(parsed.bands)) {
        throw new Error('報表定義格式不正確，缺少 bands 陣列。');
      }
      setReport(parsed);
      alert('像素級報表模型已成功套用！您可切換至「視覺畫布」或「即時預覽」查看渲染效果。');
    } catch (err) {
      alert(`JSON 解析失敗: ${(err as Error).message}`);
    }
  };

  // Calculate printable width and total controls
  const totalControls = report.bands.reduce((acc, b) => acc + b.controls.length, 0);
  const { printableWidth } = getPageGeometry(report.pageSettings);

  const handleSendPrompt = () => {
    if (!promptInput.trim()) return;
    const input = promptInput.trim();
    const newLogs = [...chatLogs, { role: 'user' as const, text: input }];

    // Interactive simulated agent responses with real pixel modifications
    if (input.includes('公司') || input.includes('抬頭') || input.includes('名稱')) {
      updateControl('band-report-header', 'ctl-company-title', {
        text: '大同世界科技股份有限公司 (Tatung System Technologies)',
      });
      newLogs.push({
        role: 'agent',
        text: '已調用 update_control 工具：修改「band-report-header」中的「ctl-company-title」控制項文字為「大同世界科技股份有限公司」，保持字級 16pt 與居中對齊。',
        action: 'update_control("band-report-header", "ctl-company-title", { text: ... })',
      });
    } else if (input.includes('底色') || input.includes('藍') || input.includes('深藍')) {
      // Modify table header background to deep business blue
      const updatedBands = report.bands.map((band) => {
        if (band.type === 'PageHeader') {
          return {
            ...band,
            controls: band.controls.map((ctrl) => ({
              ...ctrl,
              style: {
                ...ctrl.style,
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                borderColor: '#1e40af',
              },
            })),
          };
        }
        return band;
      });
      setReport({ ...report, bands: updatedBands });
      newLogs.push({
        role: 'agent',
        text: '已批量調用 set_band_controls：將 PageHeader 表頭全部儲存格底色調整為商務深藍 (#1e3a8a)，字體顏色轉為純白 (#ffffff)，提升視覺對比與專業度！',
        action: 'set_band_controls("band-page-header", ...)',
      });
    } else if (input.includes('簽') || input.includes('核決') || input.includes('印章')) {
      newLogs.push({
        role: 'agent',
        text: 'ReportFooter 內已具備企業標準四格簽核矩陣（製單人員、業務主管、倉管點收、客戶簽收蓋章），寬度分別為 122pt/122pt/122pt/131pt，均帶有獨立外框與 42pt 留空簽章空間。',
      });
    } else {
      newLogs.push({
        role: 'agent',
        text: `已收到指令：「${input}」。在像素級模式下，Agent 可以透過 MCP 或代碼精確微調任何控制項的 x, y, width, height, 邊框粗細與文字對齊！`,
      });
    }

    setChatLogs(newLogs);
    setPromptInput('');
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-3.25rem)] bg-slate-900 text-slate-100 select-none overflow-hidden">
      {/* Left Column: Pixel-Level Agent Copilot Chat & Quick Actions */}
      <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-950">
        {/* Header */}
        <div className="h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-xs text-slate-200">
              AI 智慧報表設計助理
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center space-x-1">
              <Ruler className="h-2.5 w-2.5 mr-0.5" />
              <span>帶狀報表引擎</span>
            </span>
          </div>
        </div>

        {/* Quick Agent Actions Bar */}
        <div className="p-3 bg-slate-900/40 border-b border-slate-800 space-y-2">
          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>智慧助理操作示範：</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateControl('band-report-header', 'ctl-company-title', {
                  text: '宏碁資通全球股份有限公司 (Acer Info Tech Corp.)',
                });
              }}
              className="h-7 text-xs bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-200"
            >
              微調公司抬頭
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updatedBands = report.bands.map((band) => {
                  if (band.type === 'PageHeader') {
                    return {
                      ...band,
                      controls: band.controls.map((ctrl) => ({
                        ...ctrl,
                        style: {
                          ...ctrl.style,
                          backgroundColor: '#0f766e',
                          color: '#ffffff',
                          borderColor: '#115e59',
                        },
                      })),
                    };
                  }
                  return band;
                });
                setReport({ ...report, bands: updatedBands });
              }}
              className="h-7 text-xs bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-teal-300"
            >
              表頭換財會翡翠色
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => resetToSample()}
              className="h-7 text-xs bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300"
            >
              還原企業標準單
            </Button>
          </div>
        </div>

        {/* Conversation Logs */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
          {chatLogs.map((log, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                log.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-2.5 leading-relaxed ${
                  log.role === 'user'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700'
                }`}
              >
                {log.role === 'agent' && (
                  <div className="flex items-center space-x-1.5 text-[10px] text-blue-400 font-semibold mb-1">
                    <Sparkles className="h-3 w-3" />
                    <span>AI 智慧助理</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{log.text}</p>
                {log.action && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700/60 font-mono text-[10px] text-emerald-400">
                    <span className="text-slate-400">調用操作: </span>
                    {log.action}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
            placeholder={
              locale === 'zh-TW'
                ? '輸入排版需求 (例如：將抬頭改為大同世界科技、表頭換成深藍色...)'
                : 'Enter layout instructions (e.g. change title to Tatung Tech, change header to deep blue...)'
            }
            className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            size="sm"
            onClick={handleSendPrompt}
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            <span>{locale === 'zh-TW' ? '發送' : 'Send'}</span>
          </Button>
        </div>
      </div>

      {/* Right Column: Full Pixel-Level ReportDefinition JSON Editor */}
      <div className="w-1/2 flex flex-col bg-slate-900">
        {/* Editor Toolbar */}
        <div className="h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code2 className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-xs text-slate-200">
              {locale === 'zh-TW' ? '報表規格定義模型' : 'Report IR Model'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                  <span>{locale === 'zh-TW' ? '已複製' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  <span>{locale === 'zh-TW' ? '複製定義' : 'Copy IR'}</span>
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleApplyJson}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              <span>{locale === 'zh-TW' ? '套用定義' : 'Apply'}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('preview')}
              className="h-7 text-xs border-blue-700 bg-blue-950/60 hover:bg-blue-900 text-blue-300 cursor-pointer"
            >
              <FileCheck className="h-3.5 w-3.5 mr-1" />
              <span>{locale === 'zh-TW' ? '即時預覽' : 'Preview'}</span>
            </Button>
          </div>
        </div>

        {/* Status Info Bar */}
        <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <span>{report.bands.length} {locale === 'zh-TW' ? '個區段' : 'Bands'}</span>
            </span>
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
              <span>{totalControls} {locale === 'zh-TW' ? '個控制項' : 'Controls'}</span>
            </span>
          </div>
          <div className="text-slate-400 font-mono text-[10px]">
            {locale === 'zh-TW' ? '紙張: ' : 'Paper: '}{report.pageSettings.size} | {locale === 'zh-TW' ? '可繪寬度: ' : 'Printable Width: '}{printableWidth.toFixed(2)} pt
          </div>
        </div>

        {/* Raw Code Editor Area */}
        <div className="flex-1 p-3 bg-slate-950 overflow-hidden flex flex-col">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 bg-slate-900/90 text-emerald-300/90 font-mono text-[11px] leading-relaxed p-3 rounded-md border border-slate-800 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
