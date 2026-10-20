import { Minus } from 'lucide-react';
import { View } from '@react-pdf/renderer';
import type { ReportControlPlugin } from '../types';

export const LineControl: ReportControlPlugin = {
  type: 'Line',
  displayName: '分隔線條',
  category: 'shape',
  categoryName: '圖形與裝飾',
  description: '用於區塊分隔、表格橫線、裝飾線條',
  icon: Minus,
  defaultWidth: 515,
  defaultHeight: 1,
  createDefault: (overrides) => ({
    type: 'Line',
    width: 515,
    height: 1,
    lineOrientation: 'horizontal',
    style: {
      color: '#cbd5e1',
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }) => {
    const isVertical = control.lineOrientation === 'vertical';
    return (
      <div
        className="w-full h-full"
        style={{
          width: isVertical ? `${control.width}pt` : '100%',
          height: isVertical ? '100%' : `${control.height}pt`,
          backgroundColor: control.style?.color || '#cbd5e1',
        }}
      />
    );
  },
  renderPdf: ({ control }) => {
    const isVertical = control.lineOrientation === 'vertical';
    return (
      <View
        key={control.id}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: isVertical ? 1 : control.width,
          height: isVertical ? control.height : 1,
          backgroundColor: control.style?.color || '#cbd5e1',
        }}
      />
    );
  },
};
