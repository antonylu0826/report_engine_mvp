import { isFlowBand } from '@/report/pagination';
import { useCurrentLocale } from '@/i18n';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Layers, ArrowDownUp, Trash2 } from 'lucide-react';
import type { BandDefinition } from '@/types/report';
import { useTranslations } from '@/i18n';
import { FieldSelectInput } from './FieldSelectInput';

interface BandPropertiesSectionProps {
  band: BandDefinition;
  sampleFields: string[];
  onUpdateHeight: (height: number) => void;
  onUpdateProp: (patch: Record<string, unknown>) => void;
  onRemoveGroup: () => void;
}

export const BandPropertiesSection: React.FC<BandPropertiesSectionProps> = ({
  band,
  sampleFields,
  onUpdateHeight,
  onUpdateProp,
  onRemoveGroup,
}) => {
  const tProps = useTranslations('propertyGrid');
  const zh=useCurrentLocale().locale==='zh-TW';

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-slate-500">{tProps('bandHeight')}</Label>
        <Input
          type="number"
          value={band.height}
          onChange={(e) => onUpdateHeight(Number(e.target.value) || 20)}
          className="bg-white dark:bg-slate-950"
        />
      </div>

      {/* Grouping Settings for GroupHeader / GroupFooter */}
      {['GroupHeader', 'GroupFooter'].includes(band.type) && (
        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-2 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('groupSettings')}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-slate-600 dark:text-slate-400">{tProps('groupByField')}</Label>
            <FieldSelectInput
              value={band.groupBy ?? ''}
              placeholder={tProps('placeholderGroupByField')}
              sampleFields={sampleFields}
              selectPlaceholder={tProps('selectField')}
              title={tProps('quickApplyField')}
              onChange={(val) => onUpdateProp({ groupBy: val })}
            />
            <p className="text-[9px] text-slate-500">
              {tProps('groupByHint')}
            </p>
          </div>

          <div>
            <Label className="text-[10px] text-slate-600 dark:text-slate-400">{tProps('groupSortOrder')}</Label>
            <select
              value={band.groupSortOrder || 'asc'}
              onChange={(e) =>
                onUpdateProp({ groupSortOrder: e.target.value as 'asc' | 'desc' })
              }
              className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="asc">{tProps('sortAsc')}</option>
              <option value="desc">{tProps('sortDesc')}</option>
            </select>
          </div>

          <div className="pt-1 space-y-1">
            <label className="flex items-center space-x-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={band.pageBreakAfter ?? false}
                onChange={(e) => onUpdateProp({ pageBreakAfter: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="flex items-center space-x-1 text-slate-700 dark:text-slate-300">
                <ArrowDownUp className="h-3 w-3 text-slate-500" />
                <span>{tProps('pageBreakAfterGroup')}</span>
              </span>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(tProps('confirmRemoveGroup'))) {
                  onRemoveGroup();
                }
              }}
              className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-7"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <span>{tProps('removeGroup')}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Keep Together */}
      <div className="p-2.5 rounded-md bg-white border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
        <label className="flex gap-2 text-[11px] font-medium mb-1"><input type="checkbox" aria-label={zh?'固定區段保持同頁':'Keep fixed band together'} disabled={isFlowBand(band)} checked={!isFlowBand(band)&&band.keepTogether!==false} onChange={e=>onUpdateProp({keepTogether:e.target.checked})}/>{zh?'固定區段保持同頁':'Keep fixed band together'}</label>
        <p className="text-[10px] text-slate-400">{isFlowBand(band)?(zh?'含自動增高或子報表的區段依內容續頁，不強制整段同頁。':'Growing content and subreports continue across pages.'):(band.keepTogether!==false?(zh?'整個固定區段移到同一頁。':'The complete fixed band stays on one page.'):(zh?'可在完整資料列之間換頁，列內不分割。':'Breaks are allowed between complete rows.'))}</p>
      </div>
    </div>
  );
};
