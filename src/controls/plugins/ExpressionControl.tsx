import { Calculator } from 'lucide-react';
import { Text } from '@react-pdf/renderer';
import type { ReportControlPlugin } from '../types';
import { mapControlStyle } from '../styleUtils';
import { evaluateExpression } from '@/compiler/evaluator';
import { formatValue } from '@/compiler/formatters';

export const ExpressionControl: ReportControlPlugin = {
  type: 'Expression',
  displayName: '計算運算式',
  category: 'data',
  categoryName: '資料綁定',
  description: '動態統計運算 (例如 =SUM(amount)、=COUNT()、[PageNumber])',
  icon: Calculator,
  defaultWidth: 100,
  defaultHeight: 16,
  createDefault: (overrides) => ({
    type: 'Expression',
    expression: '=SUM(amount)',
    width: 100,
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
      <span className="truncate font-mono text-[10px] text-purple-800 bg-purple-50/90 px-1 py-0.5 rounded border border-purple-300/80 shadow-xs">
        {control.expression || '=EXPR'}
      </span>
    );
  },
  renderPdf: ({ control, context }) => {
    const style = mapControlStyle(control);
    // Dynamic page numbers handled by react-pdf render prop
    if (control.expression?.includes('[PageNumber]') || control.expression?.includes('[TotalPages]')) {
      return (
        <Text
          key={control.id}
          style={style}
          render={({ pageNumber, totalPages }) => {
            const pattern = control.expression ?? '';
            return pattern
              .replace(/\[PageNumber\]/g, String(pageNumber))
              .replace(/\[TotalPages\]/g, String(totalPages));
          }}
        />
      );
    }

    const rawVal = evaluateExpression(control.expression, undefined, context);
    const text = formatValue(rawVal, control.formatString);
    return (
      <Text key={control.id} style={style}>
        {text}
      </Text>
    );
  },
};
