import { TableProperties, Layers } from 'lucide-react';
import { View, Text } from '@react-pdf/renderer';
import type { ReportControlPlugin } from '../types';
import { getNestedValue } from '@/compiler/evaluator';

export interface SubReportRowItem {
  serialNo?: string;
  lotNo?: string;
  location?: string;
  qcStatus?: string;
  [key: string]: unknown;
}

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
    subReportTitle: '產品出廠序號與品檢明細 (一對多子報表)',
    subReportBinding: 'serials',
    style: {
      backgroundColor: '#f8fafc',
      borderColor: '#94a3b8',
      borderWidth: 0.5,
      borderStyle: 'solid',
      fontSize: 7.5,
    },
    ...overrides,
  }),

  DesignerComponent: ({ control, isSelected }) => {
    const title = control.subReportTitle || '產品出廠序號與品檢明細 (一對多子報表)';
    const binding = control.subReportBinding || 'serials';

    return (
      <div
        className={`w-full h-full flex flex-col justify-between overflow-hidden rounded-xs transition-all pointer-events-none ${
          isSelected
            ? 'bg-blue-50/70 border-blue-500 shadow-xs'
            : 'bg-slate-50/80 border-slate-300 hover:border-slate-400'
        } border border-dashed p-1.5`}
      >
        {/* SubReport Header Strip in Designer Canvas */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
          <div className="flex items-center space-x-1.5 min-w-0">
            <span className="p-0.5 rounded bg-blue-100 text-blue-700">
              <TableProperties className="w-3 h-3" />
            </span>
            <span className="text-[10px] font-bold text-slate-800 truncate">
              {title}
            </span>
            <span className="inline-flex items-center text-[9px] font-mono text-blue-700 bg-blue-100/70 px-1 rounded">
              <Layers className="w-2.5 h-2.5 mr-0.5" />
              {binding}
            </span>
          </div>
          <span className="text-[8.5px] text-slate-500 bg-white border border-slate-200 px-1 rounded shrink-0">
            一對多巢狀清單
          </span>
        </div>

        {/* Mock Preview Rows for Designer Visibility */}
        <div className="flex flex-col space-y-0.5 pt-1 text-[8px] text-slate-600 font-mono">
          <div className="grid grid-cols-4 gap-1 text-[8px] font-semibold text-slate-500 bg-slate-200/50 px-1 py-0.5 rounded-2xs">
            <span>出廠序號 (S/N)</span>
            <span>製造批號</span>
            <span>出貨儲位</span>
            <span className="text-right">品檢狀態</span>
          </div>
          <div className="grid grid-cols-4 gap-1 px-1 py-0.2 text-slate-700">
            <span className="truncate">↳ SN26-MBP-001-01</span>
            <span>LOT-20261001</span>
            <span>倉位 1-01</span>
            <span className="text-right text-emerald-600 font-semibold">合格 PASS</span>
          </div>
        </div>
      </div>
    );
  },

  renderPdf: ({ control, context }) => {
    // 1. Resolve nested sub-data array from current row
    const binding = control.subReportBinding || 'serials';
    const rawItems = context.currentRow
      ? (getNestedValue(context.currentRow, binding) as SubReportRowItem[] | undefined)
      : undefined;

    // Default sample fallback if no runtime context
    const items: SubReportRowItem[] = Array.isArray(rawItems) && rawItems.length > 0
      ? rawItems
      : [
          {
            serialNo: 'SN26-OPT-001',
            lotNo: 'LOT-20261001',
            location: '倉位 1-01',
            qcStatus: '合格 PASS',
          },
        ];

    return (
      <View
        key={control.id}
        style={{
          position: 'relative',
          width: control.width,
          marginTop: control.y,
          marginBottom: 2,
          paddingLeft: 35, // Align with SKU column for hierarchical indentation
          paddingRight: 0,
        }}
      >
        {/* SubReport Mini Box Container */}
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: '#0284c7', // Cyan left accent marker
            borderBottomWidth: 0.5,
            borderBottomColor: '#cbd5e1',
            borderRightWidth: 0.5,
            borderRightColor: '#e2e8f0',
            borderTopWidth: 0.5,
            borderTopColor: '#e2e8f0',
            backgroundColor: '#f8fafc',
            paddingVertical: 3,
            paddingHorizontal: 6,
          }}
        >
          {/* SubTable Header */}
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 0.5,
              borderBottomColor: '#cbd5e1',
              paddingBottom: 2,
              marginBottom: 2,
            }}
          >
            <Text style={{ width: '40%', fontSize: 6.8, fontWeight: 'bold', color: '#475569' }}>
              出廠序號 (S/N)
            </Text>
            <Text style={{ width: '25%', fontSize: 6.8, fontWeight: 'bold', color: '#475569' }}>
              生產批號
            </Text>
            <Text style={{ width: '20%', fontSize: 6.8, fontWeight: 'bold', color: '#475569' }}>
              出貨儲位
            </Text>
            <Text style={{ width: '15%', fontSize: 6.8, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>
              品檢結果
            </Text>
          </View>

          {/* SubTable Rows */}
          {items.map((sub, idx) => (
            <View
              key={`sub-${idx}`}
              style={{
                flexDirection: 'row',
                paddingVertical: 1.5,
                borderBottomWidth: idx < items.length - 1 ? 0.3 : 0,
                borderBottomColor: '#e2e8f0',
              }}
            >
              <Text style={{ width: '40%', fontSize: 6.8, color: '#1e293b' }}>
                {`↳ ${String(sub.serialNo || '-')}`}
              </Text>
              <Text style={{ width: '25%', fontSize: 6.8, color: '#475569' }}>
                {String(sub.lotNo || '-')}
              </Text>
              <Text style={{ width: '20%', fontSize: 6.8, color: '#475569' }}>
                {String(sub.location || '-')}
              </Text>
              <Text
                style={{
                  width: '15%',
                  fontSize: 6.8,
                  fontWeight: 'bold',
                  color: '#059669',
                  textAlign: 'right',
                }}
              >
                {String(sub.qcStatus || '合格')}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  },
};
