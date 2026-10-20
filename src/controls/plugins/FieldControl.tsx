import { Database } from 'lucide-react';
import { Text } from '@react-pdf/renderer';
import type { ReportControlPlugin } from '../types';
import { mapControlStyle } from '../styleUtils';
import { evaluateExpression } from '@/compiler/evaluator';
import { formatValue } from '@/compiler/formatters';

export const FieldControl: ReportControlPlugin = {
  type: 'Field',
  displayName: '資料欄位綁定',
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
  DesignerComponent: ({ control }) => {
    return (
      <span className="truncate font-mono text-[10px] text-emerald-800 bg-emerald-50/90 px-1 py-0.5 rounded border border-emerald-300/80 shadow-xs">
        [{control.fieldName || '欄位未指定'}]
      </span>
    );
  },
  renderPdf: ({ control, context }) => {
    const style = mapControlStyle(control);
    const rawVal = evaluateExpression(undefined, control.fieldName, context);
    const text = formatValue(rawVal, control.formatString);
    return (
      <Text key={control.id} style={style}>
        {text}
      </Text>
    );
  },
};
