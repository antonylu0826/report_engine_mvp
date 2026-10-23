import React from 'react';
import { Type } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const LabelControl: ReportControlPlugin = {
  type: 'Label',
  displayName: '文字標籤',
  category: 'basic',
  categoryName: '基本控制項',
  description: '用於單據標題、固定提示說明、欄位表頭標題等',
  icon: Type,
  defaultWidth: 100,
  defaultHeight: 16,
  createDefault: (overrides) => ({
    type: 'Label',
    text: '文字標籤',
    width: 100,
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
      <span
        className="truncate select-none"
        style={{
          width: control.style?.textAlign ? '100%' : undefined,
          textAlign: control.style?.textAlign ?? 'left',
        }}
      >
        {control.text}
      </span>
    );
  },
};
