import React from 'react';
import {
  Type,
  Database,
  Calculator,
  Minus,
  Layers,
  Plus,
  TableProperties,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import type { ControlType } from '@/types/report';

export const Toolbox: React.FC = () => {
  const { report, data, addControl, selectedBandId, selectControl } = useReportStore();

  // Find target band to add control (defaults to Detail or selected band)
  const targetBandId = selectedBandId || report.bands.find((b) => b.type === 'Detail')?.id || report.bands[0]?.id;

  const handleAddControl = (type: ControlType, defaults: { text?: string; fieldName?: string; expression?: string; width?: number; height?: number }) => {
    if (!targetBandId) return;

    addControl(targetBandId, {
      type,
      x: 20,
      y: 4,
      width: defaults.width ?? 120,
      height: defaults.height ?? 16,
      text: defaults.text,
      fieldName: defaults.fieldName,
      expression: defaults.expression,
      style: {
        fontSize: 9,
        color: '#0f172a',
        textAlign: 'left',
      },
    });
  };

  // Get sample data fields
  const sampleFields = data && data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950/40">
      {/* 1. Controls Toolbox */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300">
          <Layers className="h-3.5 w-3.5 text-slate-500" />
          <span>控制項工具箱</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleAddControl('Label', { text: '文字標籤', width: 100, height: 16 })}
            className="flex items-center space-x-2 px-2.5 py-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Type className="h-3.5 w-3.5 text-blue-500" />
            <span>靜態標籤</span>
          </button>

          <button
            onClick={() => handleAddControl('Field', { fieldName: sampleFields[0] || 'fieldName', width: 120, height: 16 })}
            className="flex items-center space-x-2 px-2.5 py-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Database className="h-3.5 w-3.5 text-emerald-500" />
            <span>資料欄位</span>
          </button>

          <button
            onClick={() => handleAddControl('Expression', { expression: '=SUM(amount)', width: 100, height: 16 })}
            className="flex items-center space-x-2 px-2.5 py-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Calculator className="h-3.5 w-3.5 text-purple-500" />
            <span>計算運算式</span>
          </button>

          <button
            onClick={() => handleAddControl('Line', { width: 523, height: 1 })}
            className="flex items-center space-x-2 px-2.5 py-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Minus className="h-3.5 w-3.5 text-slate-500" />
            <span>水平線條</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          提示：點擊將加入至當前選取的帶狀區塊。
        </p>
      </div>

      {/* 2. Band Explorer */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300">
          <TableProperties className="h-3.5 w-3.5 text-slate-500" />
          <span>帶狀結構 (Bands)</span>
        </div>

        <div className="space-y-1">
          {report.bands.map((band) => {
            const isSelected = selectedBandId === band.id;
            return (
              <div
                key={band.id}
                onClick={() => selectControl(band.id, null)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white font-medium dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span>{band.type}</span>
                <span className={`text-[10px] font-mono ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                  {band.height} pt ({band.controls.length})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Available Data Fields */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 dark:text-slate-300">
          <Database className="h-3.5 w-3.5 text-slate-500" />
          <span>資料集欄位清單</span>
        </div>

        <div className="space-y-1">
          {sampleFields.map((field) => (
            <div
              key={field}
              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white border border-slate-200 text-xs group hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800"
            >
              <div className="truncate font-mono text-[11px] text-slate-800 dark:text-slate-200">
                {field}
              </div>
              <button
                onClick={() => {
                  const detailBand = report.bands.find((b) => b.type === 'Detail');
                  if (detailBand) {
                    addControl(detailBand.id, {
                      type: 'Field',
                      x: 30,
                      y: 4,
                      width: 100,
                      height: 14,
                      fieldName: field,
                      style: { fontSize: 9, color: '#0f172a' },
                    });
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                title="加入至 DetailBand"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
