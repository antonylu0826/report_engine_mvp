import React from 'react';
import { TableProperties, Layers } from 'lucide-react';
import type { ReportControlPlugin } from '../types';
import { useReportStore } from '@/store/useReportStore';
import { createDefaultSubReportDefinition } from '@/report/defaultSubReport';

export const SubReportControl: ReportControlPlugin = {
  type: 'SubReport',
  displayName: '子報表 (SubReport)',
  category: 'data',
  categoryName: '動態資料與運算',
  description: '一對多巢狀子明細表，如產品序號清單、配件明細或關聯紀錄',
  icon: TableProperties,
  defaultWidth: 515,
  defaultHeight: 46,
  createDefault: (overrides) => ({
    type: 'SubReport',
    width: 515,
    height: 46,
    subReportTitle: '序號與檢驗明細',
    subReportBinding: 'serials',
    subReportDefinition: createDefaultSubReportDefinition('序號與檢驗明細'),
    style: {
      backgroundColor: '#f8fafc',
      borderColor: '#94a3b8',
      borderWidth: 0.5,
      borderStyle: 'solid',
      fontSize: 7.5,
    },
    ...overrides,
  }),

  DesignerComponent: ({ control, isSelected }): React.ReactElement => {
    const title = control.subReportTitle || '序號與檢驗明細';
    const binding = control.subReportBinding || 'serials';

    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          const state = useReportStore.getState();
          const parentBand = state.report.bands.find((b) =>
            b.controls.some((c) => c.id === control.id)
          );
          if (parentBand) {
            state.enterSubReportEditor(parentBand.id, control.id);
          }
        }}
        className={`w-full h-full flex flex-col justify-between overflow-hidden rounded-md transition-all ${
          isSelected
            ? 'bg-slate-50 dark:bg-slate-900 border-slate-900 dark:border-slate-100 shadow-xs ring-1 ring-slate-400'
            : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700 hover:border-slate-400'
        } border border-dashed p-1.5`}
        title="雙擊此處或在右側屬性面板可進入次級畫布進行排版"
      >
        {/* SubReport Header Strip in Designer Canvas */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-1">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="p-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <TableProperties className="w-3 h-3" />
            </span>
            <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {title}
            </span>
            <span className="inline-flex items-center text-[9px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">
              <Layers className="w-2.5 h-2.5 mr-0.5" />
              {binding}
            </span>
          </div>
        </div>

        {/* Mock Preview Rows for Designer Visibility */}
        <div className="flex flex-col space-y-0.5 pt-1 text-[8px] text-slate-600 font-mono">
          <div className="grid grid-cols-4 gap-1 text-[8px] font-semibold text-slate-500 bg-slate-200/50 px-1 py-0.5 rounded-2xs">
            <span>出廠序號 (S/N)</span>
            <span>序號條碼 (CODE128)</span>
            <span>製造批號</span>
            <span className="text-right">品檢狀態</span>
          </div>
          <div className="grid grid-cols-4 gap-1 px-1 py-0.2 text-slate-700">
            <span className="truncate">↳ SN26-MBP-001-01</span>
            <span className="text-blue-600 font-mono">|||||||||||||</span>
            <span>LOT-20261001</span>
            <span className="text-right text-emerald-600 font-semibold">合格 PASS</span>
          </div>
        </div>
      </div>
    );
  },
};
