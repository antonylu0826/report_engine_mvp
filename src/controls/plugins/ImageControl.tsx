import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { ReportControlPlugin } from '../types';

export const ImageControl: ReportControlPlugin = {
  type: 'Image',
  displayName: '影像 (Image)',
  category: 'basic',
  categoryName: '基本控制項',
  description: '公司商標 Logo、產品圖片或靜態圖樣',
  icon: ImageIcon,
  defaultWidth: 120,
  defaultHeight: 60,
  createDefault: (overrides) => ({
    type: 'Image',
    width: 120,
    height: 60,
    src: '',
    objectFit: 'contain',
    ...overrides,
  }),
  DesignerComponent: ({ control }): React.ReactElement => {
    if (!control.src) {
      return (
        <div className="w-full h-full border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-1 select-none">
          <ImageIcon className="h-5 w-5 mb-1 stroke-[1.5]" />
          <span className="text-[9px] font-mono">未設定圖片</span>
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-hidden flex items-center justify-center">
        <img
          src={control.src}
          alt="Report Graphic"
          className="w-full h-full pointer-events-none"
          style={{ objectFit: control.objectFit || 'contain' }}
        />
      </div>
    );
  },
};
