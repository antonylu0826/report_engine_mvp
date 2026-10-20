import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Database,
  CheckCircle2,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import { controlRegistry } from '@/controls/registry';
import type { ControlType } from '@/types/report';

export const Toolbox: React.FC = () => {
  const {
    report,
    data,
    addControl,
    selectedBandId,
    selectControl,
  } = useReportStore();

  const [activeBandDropdown, setActiveBandDropdown] = useState(false);
  const [justAddedControlId, setJustAddedControlId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  // Target band to add control (selected band, or fallback to Detail, or first band)
  const targetBand =
    report.bands.find((b) => b.id === selectedBandId) ||
    report.bands.find((b) => b.type === 'Detail') ||
    report.bands[0];

  const handleAddControl = (type: ControlType) => {
    if (!targetBand) return;

    const plugin = controlRegistry.get(type);
    if (!plugin) return;

    const defaults = plugin.createDefault();

    addControl(targetBand.id, {
      type,
      x: 20,
      y: 6,
      width: defaults.width ?? plugin.defaultWidth,
      height: defaults.height ?? plugin.defaultHeight,
      text: defaults.text,
      fieldName: defaults.fieldName,
      expression: defaults.expression,
      barcodeFormat: defaults.barcodeFormat,
      displayValue: defaults.displayValue,
      qrErrorLevel: defaults.qrErrorLevel,
      lineOrientation: defaults.lineOrientation,
      style: {
        fontSize: 9,
        color: '#0f172a',
        textAlign: 'left',
        ...defaults.style,
      },
    });

    setJustAddedControlId(type);
    setTimeout(() => setJustAddedControlId(null), 1200);
  };

  // Get sample data fields
  const sampleFields = data && data.length > 0 ? Object.keys(data[0]) : [];
  const filteredFields = fieldSearch
    ? sampleFields.filter((f) => f.toLowerCase().includes(fieldSearch.toLowerCase()))
    : sampleFields;

  const categories = controlRegistry.getCategories();

  return (
    <aside className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950">
      {/* 1. Target Band Selector Card */}
      <div className="p-3 border-b border-slate-200 bg-white/70 backdrop-blur dark:bg-slate-900/60 dark:border-slate-800">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Layers className="h-3 w-3 text-blue-500" />
            <span>控制項加入目標區塊</span>
          </span>
          <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded dark:bg-blue-950 dark:text-blue-300">
            作用中
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setActiveBandDropdown(!activeBandDropdown)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs hover:border-blue-400 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          >
            <div className="flex items-center space-x-2 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span className="font-semibold truncate">{targetBand?.type}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({targetBand?.height} pt)
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
          </button>

          {activeBandDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1 max-h-56 overflow-y-auto dark:bg-slate-900 dark:border-slate-800">
              {report.bands.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    selectControl(b.id, null);
                    setActiveBandDropdown(false);
                  }}
                  className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    b.id === targetBand?.id
                      ? 'bg-blue-50/80 font-semibold text-blue-600 dark:bg-slate-800 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate">{b.type}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {b.controls.length} 個控制項
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Categorized Controls Toolbox */}
      <div className="p-3 border-b border-slate-200 flex-1 overflow-y-auto dark:border-slate-800 space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 tracking-wide flex items-center space-x-1.5">
              <span>{cat.name}</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {cat.controls.map((ctrl) => {
                const IconComponent = ctrl.icon;
                const isJustAdded = justAddedControlId === ctrl.type;

                return (
                  <button
                    key={ctrl.type}
                    onClick={() => handleAddControl(ctrl.type)}
                    className="w-full group text-left px-2.5 py-2 rounded-md bg-white border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:shadow-xs hover:bg-blue-50/20 transition-all flex items-center justify-between dark:bg-slate-900 dark:border-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-800/80"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-400">
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                          <span>{ctrl.displayName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[155px]">
                          {ctrl.description}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-1">
                      {isJustAdded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 animate-in zoom-in" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Available Data Fields Explorer (Expanded & Clean) */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          <span className="flex items-center space-x-1">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            <span>資料集可用欄位</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {sampleFields.length} 欄位
          </span>
        </div>

        {/* Quick Search */}
        {sampleFields.length > 5 && (
          <div className="relative mb-2">
            <Search className="h-3 w-3 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋欄位..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="w-full text-[11px] pl-6 pr-2 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400 transition-colors dark:bg-slate-900 dark:border-slate-800"
            />
          </div>
        )}

        {/* Field Chips */}
        <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
          {filteredFields.map((field) => (
            <button
              key={field}
              onClick={() => {
                const target = targetBand || report.bands.find((b) => b.type === 'Detail');
                if (target) {
                  addControl(target.id, {
                    type: 'Field',
                    x: 30,
                    y: 4,
                    width: 100,
                    height: 14,
                    fieldName: field,
                    style: { fontSize: 9, color: '#0f172a' },
                  });
                }
              }}
              className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              title="點擊新增欄位至目標區塊"
            >
              <span>{field}</span>
              <Plus className="h-2.5 w-2.5 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
