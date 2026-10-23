import React from 'react';
import { CheckSquare } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const CheckBoxControl: ReportControlPlugin = {
  type: 'CheckBox',
  displayName: '核取方塊 (CheckBox)',
  category: 'basic',
  categoryName: '基本控制項',
  description: '布林狀態、欄位勾選核取或確認註記',
  icon: CheckSquare,
  defaultWidth: 80,
  defaultHeight: 18,
  createDefault: (overrides) => ({
    type: 'CheckBox',
    width: 80,
    height: 18,
    checked: false,
    checkText: '核取項目',
    style: {
      fontSize: 9,
      color: '#0f172a',
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }): React.ReactElement => {
    const isChecked = !!control.checked;
    return (
      <div className="w-full h-full flex items-center space-x-1.5 select-none overflow-hidden">
        <div
          className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center transition-colors ${
            isChecked
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'border-slate-400 bg-white'
          }`}
        >
          {isChecked && (
            <svg
              className="w-2.5 h-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <span
          className="truncate"
          style={{
            fontSize: `${control.style?.fontSize || 9}pt`,
            color: control.style?.color || '#0f172a',
            fontFamily: control.style?.fontFamily,
          }}
        >
          {control.checkText || (control.fieldName ? `[${control.fieldName}]` : '')}
        </span>
      </div>
    );
  },
};
