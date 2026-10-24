import React from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Compass } from 'lucide-react';
import type { PageSize, PageOrientation } from '@/types/report';
import { useTranslations } from '@/i18n';

export const GlobalReportSettings: React.FC = () => {
  const tProps = useTranslations('propertyGrid');
  const tCommon = useTranslations('common');
  const { getActiveReport, updateActiveReport } = useReportStore();
  const report = getActiveReport();
  const setReport = (next: typeof report) => updateActiveReport(() => next);

  const updatePageSettings = (patch: Partial<typeof report.pageSettings>) => {
    setReport({
      ...report,
      pageSettings: {
        ...report.pageSettings,
        ...patch,
      },
    });
  };

  const updatePageMargins = (patch: Partial<typeof report.pageSettings.margins>) => {
    setReport({
      ...report,
      pageSettings: {
        ...report.pageSettings,
        margins: {
          ...report.pageSettings.margins,
          ...patch,
        },
      },
    });
  };

  return (
    <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-full min-h-0 select-none dark:border-slate-800 dark:bg-slate-950 shadow-2xs overflow-y-auto">
      <div className="p-3 border-b border-slate-200 flex items-center space-x-1.5 dark:border-slate-800">
        <FileText className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          {tProps('reportSettings')}
        </span>
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Report Name */}
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-500">{tProps('reportName')}</Label>
          <Input
            value={report.name}
            onChange={(e) => setReport({ ...report, name: e.target.value })}
            className="font-medium bg-white dark:bg-slate-950"
          />
        </div>

        {/* Page Size & Orientation */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
            {tProps('pageSizeOrientation')}
          </span>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('pageSize')}</Label>
              <select
                value={report.pageSettings.size}
                onChange={(e) => updatePageSettings({ size: e.target.value as PageSize })}
                className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">Letter (8.5 × 11 in)</option>
              </select>
            </div>

            <div>
              <Label className="text-[10px] text-slate-500">{tProps('orientation')}</Label>
              <select
                value={report.pageSettings.orientation}
                onChange={(e) =>
                  updatePageSettings({ orientation: e.target.value as PageOrientation })
                }
                className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200"
              >
                <option value="portrait">{tCommon('portrait')}</option>
                <option value="landscape">{tCommon('landscape')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Margins */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider dark:text-slate-400">
              {tProps('pageMargins')}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">1 pt = 1/72 in</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('marginTop')}</Label>
              <Input
                type="number"
                value={report.pageSettings.margins.top}
                onChange={(e) => updatePageMargins({ top: Number(e.target.value) || 0 })}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('marginBottom')}</Label>
              <Input
                type="number"
                value={report.pageSettings.margins.bottom}
                onChange={(e) => updatePageMargins({ bottom: Number(e.target.value) || 0 })}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('marginLeft')}</Label>
              <Input
                type="number"
                value={report.pageSettings.margins.left}
                onChange={(e) => updatePageMargins({ left: Number(e.target.value) || 0 })}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-500">{tProps('marginRight')}</Label>
              <Input
                type="number"
                value={report.pageSettings.margins.right}
                onChange={(e) => updatePageMargins({ right: Number(e.target.value) || 0 })}
                className="bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* Helper Tips */}
        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 space-y-1">
          <div className="flex items-center space-x-1 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
            <Compass className="h-3.5 w-3.5 text-slate-500" />
            <span>{tProps('tips')}</span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            {tProps('tipsDesc')}
          </p>
        </div>
      </div>
    </aside>
  );
};
