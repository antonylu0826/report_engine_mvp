import React from 'react';
import { TableProperties, Layers } from 'lucide-react';
import type { ReportControlPlugin } from '../types';
import { useReportStoreApi } from '@/store/useReportStore';
import { createSubReportForFields } from '@/report/defaultSubReport';
import { getSubReportRows } from '@/report/subReport';
import { childSchema } from '@/report/dataSchema';
import { getNestedValue } from '@/report/dataPath';

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
    subReportDefinition: createSubReportForFields('子報表', []),
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
    const store = useReportStoreApi();
    const state = store.getState();
    const fields = childSchema(control, state.dataSource.schema)?.detailFields.filter(field => field.type !== 'array').slice(0, 4) ?? [];
    const rows = getSubReportRows(control, { currentRow: state.getActiveData()[0] });
    const title = control.subReportTitle || '子報表';
    const binding = control.subReportBinding || 'serials';

    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          const state = store.getState();
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

        <div className="flex flex-col gap-0.5 pt-1 text-[8px] text-slate-600 font-mono">
          <div className="grid gap-1 font-semibold" style={{ gridTemplateColumns: `repeat(${Math.max(1,fields.length)}, minmax(0,1fr))` }}>
            {fields.map(field => <span key={field.name} className="truncate">{field.label}</span>)}
          </div>
          {rows.length ? rows.slice(0,2).map((row,i)=><div key={i} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1,fields.length)}, minmax(0,1fr))` }}>
            {fields.map(field=><span key={field.name} className="truncate">{String(getNestedValue(row,field.name) ?? '')}</span>)}
          </div>) : <span className="text-slate-400">{fields.length ? '尚無子資料 / No child rows' : '設定陣列綁定 / Bind an array'}</span>}
        </div>
      </div>
    );
  },
};
