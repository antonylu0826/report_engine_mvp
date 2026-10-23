import React from 'react';
import { Square } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const PanelControl: ReportControlPlugin = {
  type: 'Panel',
  displayName: '面板外框 (Panel)',
  category: 'shape',
  categoryName: '圖形與容器',
  description: '矩形區塊容器、卡片外框或底色背景裝飾',
  icon: Square,
  defaultWidth: 200,
  defaultHeight: 50,
  createDefault: (overrides) => ({
    type: 'Panel',
    width: 200,
    height: 50,
    style: {
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderStyle: 'solid',
      backgroundColor: '#ffffff',
      borderRadius: 2,
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }): React.ReactElement => {
    return (
      <div
        className="w-full h-full pointer-events-none"
        style={{
          backgroundColor: control.style?.backgroundColor || 'transparent',
          borderWidth: control.style?.borderWidth !== undefined ? `${control.style.borderWidth}pt` : '1px',
          borderColor: control.style?.borderColor || '#cbd5e1',
          borderStyle: control.style?.borderStyle || 'solid',
          borderRadius: control.style?.borderRadius ? `${control.style.borderRadius}pt` : undefined,
        }}
      />
    );
  },
};
