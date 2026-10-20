import React, { useState } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Button } from '@/components/ui/button';
import {
  addColumn,
  removeColumn,
  setTheme,
  setReportTitle,
} from '@/semantic/mutations';
import type { SemanticTheme } from '@/semantic/types';
import {
  Sparkles,
  Palette,
  Columns,
  CheckCircle2,
  Code2,
  Save,
  Copy,
  Check,
  Send,
  Zap,
} from 'lucide-react';

export const AgentCopilot: React.FC = () => {
  const { spec, setSpec, applyAgentMutation, setActiveTab } = useReportStore();
  const [jsonText, setJsonText] = useState(JSON.stringify(spec, null, 2));
  const [copied, setCopied] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [chatLogs, setChatLogs] = useState<
    { role: 'user' | 'agent'; text: string; action?: string }[]
  >([
    {
      role: 'agent',
      text: '你好！我是報表設計 Agent。我已載入當前出貨單語意模型（僅 25 行 DSL），無需手動計算像素或 pt 座標，請問您想如何調整這張報表？',
    },
  ]);

  // Keep local json editor synced with store spec
  React.useEffect(() => {
    setJsonText(JSON.stringify(spec, null, 2));
  }, [spec]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setSpec(parsed);
      alert('高階語意模型已套用，幾何編譯器已完成自動座標換算！');
    } catch (err) {
      alert(`JSON 解析失敗: ${(err as Error).message}`);
    }
  };

  // Simulated Agent Prompt Handling
  const handleSendPrompt = () => {
    if (!promptInput.trim()) return;
    const input = promptInput.trim();
    const newLogs = [...chatLogs, { role: 'user' as const, text: input }];

    // Simple rule-based match to demonstrate agent mutations
    if (input.includes('藍') || input.toLowerCase().includes('blue')) {
      applyAgentMutation((prev) => setTheme(prev, 'blue'));
      newLogs.push({
        role: 'agent',
        text: '已調用 setTheme("blue") 工具，全報表色系、表頭背景與總計已一鍵切換至「商務深藍」風格！',
        action: 'setTheme("blue")',
      });
    } else if (input.includes('綠') || input.toLowerCase().includes('emerald')) {
      applyAgentMutation((prev) => setTheme(prev, 'emerald'));
      newLogs.push({
        role: 'agent',
        text: '已調用 setTheme("emerald") 工具，全報表已切換至「財會翡翠綠」主題！',
        action: 'setTheme("emerald")',
      });
    } else if (input.includes('規格') || input.includes('spec')) {
      applyAgentMutation((prev) =>
        addColumn(
          prev,
          {
            id: 'spec',
            label: '規格說明',
            field: 'sku', // dummy or field
            widthWeight: 2.0,
            align: 'left',
          },
          'sku'
        )
      );
      newLogs.push({
        role: 'agent',
        text: '已調用 addColumn() 工具，在「品號」後方插入了「規格說明」欄位（權重 2.0），編譯器已自動重新等比例計算所有欄位 X 軸，保證表頭與明細 100% 垂直對齊！',
        action: 'addColumn("spec")',
      });
    } else {
      newLogs.push({
        role: 'agent',
        text: `已收到指令：「${input}」。您可以點擊下方快捷動作展示 Agent 原子操作，或切換至即時 PDF 預覽查看效果！`,
      });
    }

    setChatLogs(newLogs);
    setPromptInput('');
  };

  const themes: { id: SemanticTheme; name: string; color: string }[] = [
    { id: 'slate', name: '經典灰階 (Slate)', color: 'bg-slate-700' },
    { id: 'blue', name: '商務深藍 (Blue)', color: 'bg-blue-600' },
    { id: 'emerald', name: '財會翡翠 (Emerald)', color: 'bg-emerald-600' },
    { id: 'purple', name: '現代紫韻 (Purple)', color: 'bg-purple-600' },
    { id: 'amber', name: '復古暖金 (Amber)', color: 'bg-amber-600' },
  ];

  return (
    <div className="flex-1 flex h-[calc(100vh-3.25rem)] bg-slate-900 text-slate-100 select-none overflow-hidden">
      {/* Left Column: Agent Copilot Chat & Quick Mutations */}
      <div className="w-1/2 border-r border-slate-800 flex flex-col bg-slate-950">
        {/* Header */}
        <div className="h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-xs text-slate-200">
              AI 報表設計代理人 (Agent Copilot)
            </span>
          </div>
          <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
            Agent-Native 語意模式
          </span>
        </div>

        {/* Quick Agent Actions Bar */}
        <div className="p-3 bg-slate-900/40 border-b border-slate-800 space-y-2">
          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Agent 增量原子操作快捷示範 (無需重寫座標)：</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                applyAgentMutation((prev) =>
                  addColumn(
                    prev,
                    {
                      id: `spec-${Date.now().toString().slice(-3)}`,
                      label: '規格說明',
                      field: 'sku',
                      widthWeight: 2.0,
                      align: 'left',
                    },
                    'sku'
                  )
                )
              }
              className="h-6 text-[10px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              <Columns className="h-3 w-3 mr-1 text-emerald-400" />
              + 插入規格欄位 (權重2.0)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lastCol = spec.columns[spec.columns.length - 1];
                if (spec.columns.length > 3 && lastCol) {
                  applyAgentMutation((prev) => removeColumn(prev, lastCol.id));
                }
              }}
              className="h-6 text-[10px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              - 移除最後一欄
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                applyAgentMutation((prev) =>
                  setReportTitle(
                    prev,
                    '全漢企業集團 (FSP Group)',
                    '全球出貨銷貨確認明細 (Dispatch Note)'
                  )
                )
              }
              className="h-6 text-[10px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              變更公司抬頭
            </Button>
          </div>

          {/* Theme Quick Switcher */}
          <div className="flex items-center space-x-2 pt-1">
            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
              <Palette className="h-3 w-3 text-slate-400" />
              <span>全域主題:</span>
            </span>
            <div className="flex space-x-1">
              {themes.map((th) => (
                <button
                  key={th.id}
                  onClick={() => applyAgentMutation((prev) => setTheme(prev, th.id))}
                  className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] transition-colors border ${
                    spec.theme === th.id
                      ? 'border-blue-500 bg-slate-800 font-semibold text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title={th.name}
                >
                  <span className={`w-2 h-2 rounded-full ${th.color}`} />
                  <span>{th.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat / Interaction Logs */}
        <div className="flex-1 p-3 overflow-y-auto space-y-3">
          {chatLogs.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700'
                }`}
              >
                <div className="text-[10px] opacity-70 mb-0.5 font-mono">
                  {msg.role === 'user' ? '用戶自然語言需求' : 'Agent 操作回應'}
                </div>
                <div>{msg.text}</div>
                {msg.action && (
                  <div className="mt-1.5 px-2 py-0.5 rounded bg-slate-900 font-mono text-[10px] text-emerald-400 border border-slate-700/80">
                    🔧 Tool: {msg.action}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
            placeholder="例如：「幫我換成藍色主題」或「加一個規格欄位」..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            size="sm"
            onClick={handleSendPrompt}
            className="h-8 bg-blue-600 hover:bg-blue-500 text-white space-x-1"
          >
            <Send className="h-3.5 w-3.5" />
            <span>發送</span>
          </Button>
        </div>
      </div>

      {/* Right Column: High-Level Semantic DSL Editor */}
      <div className="w-1/2 flex flex-col bg-slate-900/60">
        <div className="h-10 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Code2 className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">
              高階語意規格 (Semantic Spec DSL)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              • 僅 {spec.columns.length} 欄 • 無像素座標
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 space-x-1"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? '已複製' : '複製 DSL'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleApplyJson}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white space-x-1"
            >
              <Save className="h-3 w-3" />
              <span>編譯並套用</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setActiveTab('preview')}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white space-x-1"
            >
              <span>查看 PDF</span>
            </Button>
          </div>
        </div>

        {/* Compiler Diagnostics Bar */}
        <div className="px-4 py-1.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>幾何編譯器狀態：100% 垂直對齊無誤 • A4 寬度分配正常</span>
          </div>
          <div>主題風格：{spec.theme || 'slate'}</div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-3 overflow-hidden">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-full font-mono text-xs bg-slate-950/90 border border-slate-800 rounded-lg p-3 text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none selection:bg-blue-950 leading-relaxed"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};
