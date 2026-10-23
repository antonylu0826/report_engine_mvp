import React from 'react';
import { Database } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const FieldControl: ReportControlPlugin = {
  type: 'Field',
  displayName: '資料欄位',
  category: 'data',
  categoryName: '資料綁定',
  description: '綁定資料集內的特定欄位 (例如 sku、品名、金額)',
  icon: Database,
  defaultWidth: 120,
  defaultHeight: 16,
  createDefault: (overrides) => ({
    type: 'Field',
    fieldName: 'fieldName',
    width: 120,
    height: 16,
    style: {
      fontSize: 9,
      color: '#0f172a',
      textAlign: 'left',
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }): React.ReactElement => {
    return (
      <span className="truncate font-mono text-[10px] text-emerald-800 bg-emerald-50/90 px-1 py-0.5 rounded border border-emerald-300/80 shadow-xs">
        [{control.fieldName || '欄位未指定'}]
      </span>
    );
  },
};
