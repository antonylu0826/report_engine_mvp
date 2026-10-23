import React from 'react';
import { Minus } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const LineControl: ReportControlPlugin = {
  type: 'Line',
  displayName: '水平線條',
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
  DesignerComponent: ({ control }): React.ReactElement => {
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
};
