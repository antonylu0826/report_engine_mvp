import { CheckSquare } from 'lucide-react';
import { View, Text } from '@react-pdf/renderer';
import { getNestedValue } from '@/compiler/evaluator';
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
  DesignerComponent: ({ control }) => {
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
  renderPdf: ({ control, context }) => {
    // Determine checked state dynamically from row data or static property
    let isChecked = !!control.checked;
    if (control.fieldName && context.currentRow) {
      const val = getNestedValue(context.currentRow, control.fieldName);
      isChecked = val === true || val === 1 || val === '1' || val === 'true' || val === 'TRUE' || val === 'Y';
    }

    const labelText = control.checkText || '';

    return (
      <View
        key={control.id}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderWidth: 1,
            borderColor: '#334155',
            backgroundColor: isChecked ? '#1e293b' : '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
          }}
        >
          {isChecked && (
            <Text
              style={{
                fontSize: 7,
                color: '#ffffff',
                fontFamily: 'Helvetica',
                marginTop: -1,
              }}
            >
              ✓
            </Text>
          )}
        </View>
        {labelText ? (
          <Text
            style={{
              fontSize: control.style?.fontSize || 9,
              color: control.style?.color || '#0f172a',
              fontFamily: control.style?.fontFamily || 'Helvetica',
            }}
          >
            {labelText}
          </Text>
        ) : null}
      </View>
    );
  },
};
