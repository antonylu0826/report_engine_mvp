import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
import type { ControlDefinition } from '@/types/report';
import { useTranslations } from '@/i18n';
import { ColorPickerField } from './ColorPickerField';

interface TypographySectionProps {
  control: ControlDefinition;
  onUpdate: (patch: Partial<ControlDefinition>) => void;
  isBackgroundCapable?: boolean;
}

export const TypographySection: React.FC<TypographySectionProps> = ({
  control,
  onUpdate,
  isBackgroundCapable = false,
}) => {
  const tProps = useTranslations('propertyGrid');

  return (
    <>
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
          {tProps('typography')}
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">{tProps('fontSize')}</Label>
            <Input
              type="number"
              value={control.style?.fontSize ?? 9}
              onChange={(e) =>
                onUpdate({
                  style: {
                    ...control.style,
                    fontSize: Number(e.target.value) || 9,
                  },
                })
              }
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('textAlign')}</Label>
            <div className="flex border border-slate-200 rounded-md overflow-hidden dark:border-slate-800">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() =>
                    onUpdate({
                      style: { ...control.style, textAlign: align },
                    })
                  }
                  className={`flex-1 p-1.5 flex justify-center items-center transition-colors ${
                    (control.style?.textAlign || 'left') === align
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {align === 'left' && <AlignLeft className="h-3 w-3" />}
                  {align === 'center' && <AlignCenter className="h-3 w-3" />}
                  {align === 'right' && <AlignRight className="h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bold Toggle */}
        <div className="flex items-center justify-between py-1">
          <span className="text-[11px] text-slate-600 dark:text-slate-400">{tProps('bold')}</span>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                style: {
                  ...control.style,
                  fontWeight: control.style?.fontWeight === 'bold' ? 'normal' : 'bold',
                },
              })
            }
            className={`p-1.5 rounded-md border text-xs flex items-center space-x-1 cursor-pointer ${
              control.style?.fontWeight === 'bold'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            <Bold className="h-3 w-3" />
            <span className="text-[10px]">{tProps('bold')}</span>
          </button>
        </div>

        {/* Text Color */}
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('textColor')}</Label>
          <ColorPickerField
            value={control.style?.color || '#0f172a'}
            defaultValue="#0f172a"
            onChange={(color) =>
              onUpdate({
                style: { ...control.style, color: color || '#0f172a' },
              })
            }
          />
        </div>
      </div>

      {/* Background Color */}
      {isBackgroundCapable && (
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
            {tProps('bgColor')}
          </span>
          <ColorPickerField
            value={control.style?.backgroundColor}
            defaultValue="#ffffff"
            placeholder={tProps('transparent')}
            allowClear
            clearText={tProps('clear')}
            onChange={(backgroundColor) =>
              onUpdate({
                style: {
                  ...control.style,
                  backgroundColor,
                },
              })
            }
          />
        </div>
      )}
    </>
  );
};
