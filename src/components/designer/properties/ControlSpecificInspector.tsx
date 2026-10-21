import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon,
  CheckSquare,
  Square,
  Minus,
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon,
  Upload,
  TableProperties,
} from 'lucide-react';
import type { ControlDefinition } from '@/types/report';
import { useReportStore } from '@/store/useReportStore';
import { useTranslations } from '@/i18n';
import { FieldSelectInput } from './FieldSelectInput';
import { ColorPickerField } from './ColorPickerField';

interface ControlSpecificInspectorProps {
  control: ControlDefinition;
  bandId: string;
  sampleFields: string[];
  onUpdate: (patch: Partial<ControlDefinition>) => void;
}

export const ControlSpecificInspector: React.FC<ControlSpecificInspectorProps> = ({
  control,
  bandId,
  sampleFields,
  onUpdate,
}) => {
  const tProps = useTranslations('propertyGrid');

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
      <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
        {tProps('contentBinding')}
      </span>

      {/* Label */}
      {control.type === 'Label' && (
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('staticText')}</Label>
          <Input
            value={control.text ?? ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
      )}

      {/* Field (with auto-suggest dropdown) */}
      {control.type === 'Field' && (
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-500">{tProps('boundField')}</Label>
          <FieldSelectInput
            value={control.fieldName ?? ''}
            placeholder={tProps('placeholderFieldName')}
            sampleFields={sampleFields}
            selectPlaceholder={tProps('selectField')}
            title={tProps('quickApplyField')}
            onChange={(val) => onUpdate({ fieldName: val })}
          />
        </div>
      )}

      {/* Expression */}
      {control.type === 'Expression' && (
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('expression')}</Label>
          <Input
            value={control.expression ?? ''}
            onChange={(e) => onUpdate({ expression: e.target.value })}
            className="bg-white dark:bg-slate-950"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            {tProps('expressionHint')}
          </p>
        </div>
      )}

      {/* Line Specific Inspector */}
      {control.type === 'Line' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <Minus className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('lineStyle')}</span>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('lineOrientation')}</Label>
            <select
              value={control.lineOrientation || 'horizontal'}
              onChange={(e) => {
                const isVert = e.target.value === 'vertical';
                onUpdate({
                  lineOrientation: isVert ? 'vertical' : 'horizontal',
                  width: isVert ? 1 : 515,
                  height: isVert ? 30 : 1,
                });
              }}
              className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="horizontal">{tProps('horizontal')}</option>
              <option value="vertical">{tProps('vertical')}</option>
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('lineColor')}</Label>
            <ColorPickerField
              value={control.style?.color || '#cbd5e1'}
              defaultValue="#cbd5e1"
              onChange={(color) =>
                onUpdate({
                  style: { ...control.style, color: color || '#cbd5e1' },
                })
              }
            />
          </div>
        </div>
      )}

      {/* Image Specific Inspector */}
      {control.type === 'Image' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('imageSourceScale')}</span>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('imageUrl')}</Label>
            <Input
              value={control.src ?? ''}
              placeholder={tProps('placeholderImageSrc')}
              onChange={(e) => onUpdate({ src: e.target.value })}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          {/* Local Image File Upload */}
          <div>
            <Label className="text-[10px] text-slate-500">{tProps('uploadLocalImage')}</Label>
            <label className="flex items-center justify-center space-x-1.5 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer text-[11px] shadow-2xs transition-colors">
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>{tProps('chooseImageFile')}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (uploadEvent) => {
                    const result = uploadEvent.target?.result as string;
                    if (result) {
                      onUpdate({ src: result });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('objectFit')}</Label>
            <select
              value={control.objectFit || 'contain'}
              onChange={(e) =>
                onUpdate({
                  objectFit: e.target.value as 'contain' | 'cover' | 'fill',
                })
              }
              className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="contain">{tProps('fitContain')}</option>
              <option value="cover">{tProps('fitCover')}</option>
              <option value="fill">{tProps('fitFill')}</option>
            </select>
          </div>
        </div>
      )}

      {/* CheckBox Specific Inspector */}
      {control.type === 'CheckBox' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('checkBoxSettings')}</span>
          </div>

          <label className="flex items-center space-x-2 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={!!control.checked}
              onChange={(e) => onUpdate({ checked: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span className="text-slate-700 dark:text-slate-300">{tProps('defaultChecked')}</span>
          </label>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('checkTextLabel')}</Label>
            <Input
              value={control.checkText ?? ''}
              placeholder={tProps('placeholderCheckText')}
              onChange={(e) => onUpdate({ checkText: e.target.value })}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500">{tProps('orBindBooleanField')}</Label>
            <FieldSelectInput
              value={control.fieldName ?? ''}
              placeholder={tProps('placeholderBooleanField')}
              sampleFields={sampleFields}
              selectPlaceholder={tProps('selectField')}
              title={tProps('quickApplyField')}
              onChange={(val) => onUpdate({ fieldName: val })}
            />
          </div>
        </div>
      )}

      {/* Panel Specific Inspector */}
      {control.type === 'Panel' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <Square className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('panelBorderRadius')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('borderWidth')}</Label>
              <Input
                type="number"
                value={control.style?.borderWidth ?? 1}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...control.style,
                      borderWidth: Number(e.target.value) || 0,
                    },
                  })
                }
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('borderRadius')}</Label>
              <Input
                type="number"
                value={control.style?.borderRadius ?? 0}
                onChange={(e) =>
                  onUpdate({
                    style: {
                      ...control.style,
                      borderRadius: Number(e.target.value) || 0,
                    },
                  })
                }
                className="bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('borderColor')}</Label>
            <ColorPickerField
              value={control.style?.borderColor || '#cbd5e1'}
              defaultValue="#cbd5e1"
              onChange={(borderColor) =>
                onUpdate({
                  style: { ...control.style, borderColor: borderColor || '#cbd5e1' },
                })
              }
            />
          </div>
        </div>
      )}

      {/* Barcode Specific Inspector */}
      {control.type === 'Barcode' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <BarcodeIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('barcodeSettings')}</span>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('barcodeFormat')}</Label>
            <select
              value={control.barcodeFormat || 'CODE128'}
              onChange={(e) =>
                onUpdate({
                  barcodeFormat: e.target.value as 'CODE128' | 'EAN13' | 'UPC' | 'CODE39',
                })
              }
              className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="CODE128">{tProps('barcodeCode128')}</option>
              <option value="EAN13">{tProps('barcodeEan13')}</option>
              <option value="UPC">{tProps('barcodeUpc')}</option>
              <option value="CODE39">{tProps('barcodeCode39')}</option>
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('staticBarcodeText')}</Label>
            <Input
              value={control.text ?? ''}
              placeholder={tProps('placeholderStaticBarcode')}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500">{tProps('orDynamicField')}</Label>
            <FieldSelectInput
              value={control.fieldName ?? ''}
              placeholder={tProps('placeholderBarcodeField')}
              sampleFields={sampleFields}
              selectPlaceholder={tProps('selectField')}
              title={tProps('quickApplyField')}
              onChange={(val) => onUpdate({ fieldName: val })}
            />
          </div>

          <label className="flex items-center space-x-2 text-[11px] cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={control.displayValue ?? true}
              onChange={(e) => onUpdate({ displayValue: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span className="text-slate-700 dark:text-slate-300">{tProps('displayValue')}</span>
          </label>
        </div>
      )}

      {/* QRCode Specific Inspector */}
      {control.type === 'QRCode' && (
        <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
            <QrCodeIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('qrSettings')}</span>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('qrErrorLevel')}</Label>
            <select
              value={control.qrErrorLevel || 'M'}
              onChange={(e) =>
                onUpdate({
                  qrErrorLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
                })
              }
              className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="L">{tProps('qrLevelL')}</option>
              <option value="M">{tProps('qrLevelM')}</option>
              <option value="Q">{tProps('qrLevelQ')}</option>
              <option value="H">{tProps('qrLevelH')}</option>
            </select>
          </div>

          <div>
            <Label className="text-[10px] text-slate-500">{tProps('qrStaticText')}</Label>
            <Input
              value={control.text ?? ''}
              placeholder="https://..."
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500">{tProps('orDynamicField')}</Label>
            <FieldSelectInput
              value={control.fieldName ?? ''}
              placeholder={tProps('placeholderQrField')}
              sampleFields={sampleFields}
              selectPlaceholder={tProps('selectField')}
              title={tProps('quickApplyField')}
              onChange={(val) => onUpdate({ fieldName: val })}
            />
          </div>
        </div>
      )}

      {/* SubReport Specific Inspector */}
      {control.type === 'SubReport' && (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-medium text-xs">
            <TableProperties className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('subReportSettings')}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">{tProps('subReportTitle')}</Label>
            <Input
              value={control.subReportTitle ?? ''}
              placeholder={tProps('subReportTitlePlaceholder')}
              onChange={(e) => onUpdate({ subReportTitle: e.target.value })}
              className="h-8 text-xs bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">{tProps('subReportBinding')}</Label>
            <Input
              value={control.subReportBinding ?? ''}
              placeholder="serials"
              onChange={(e) => onUpdate({ subReportBinding: e.target.value })}
              className="h-8 font-mono text-xs bg-white dark:bg-slate-950"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const state = useReportStore.getState();
              state.enterSubReportEditor(bandId, control.id);
            }}
            className="w-full text-xs font-normal flex items-center justify-center space-x-1.5 mt-2 h-8"
          >
            <TableProperties className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('editSubReport')}</span>
          </Button>
        </div>
      )}

      {/* Format String for text controls */}
      {['Field', 'Expression'].includes(control.type) && (
        <div>
          <Label className="text-[10px] text-slate-500">{tProps('formatString')}</Label>
          <Input
            value={control.formatString ?? ''}
            placeholder={tProps('formatPlaceholder')}
            onChange={(e) => onUpdate({ formatString: e.target.value })}
            className="bg-white dark:bg-slate-950"
          />
        </div>
      )}
    </div>
  );
};
