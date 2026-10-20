import React, { useState } from 'react';
import {
  Layers,
  Database,
  CheckCircle2,
  ChevronDown,
  Search,
  Plus,
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
  const [controlSearch, setControlSearch] = useState('');
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
    setTimeout(() => setJustAddedControlId(null), 1000);
  };

  // Get sample data fields
  const sampleFields = data && data.length > 0 ? Object.keys(data[0]) : [];
  const filteredFields = fieldSearch
    ? sampleFields.filter((f) => f.toLowerCase().includes(fieldSearch.toLowerCase()))
    : sampleFields;

  const rawCategories = controlRegistry.getCategories();

  // Filter categories by control search query if any
  const categories = rawCategories
    .map((cat) => ({
      ...cat,
      controls: controlSearch
        ? cat.controls.filter(
            (c) =>
              c.displayName.toLowerCase().includes(controlSearch.toLowerCase()) ||
              c.type.toLowerCase().includes(controlSearch.toLowerCase()) ||
              c.description.toLowerCase().includes(controlSearch.toLowerCase())
          )
        : cat.controls,
    }))
    .filter((cat) => cat.controls.length > 0);

  return (
    <aside className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950">
      {/* 1. Target Band Selector Card */}
      <div className="p-2.5 border-b border-slate-200 bg-white/80 backdrop-blur dark:bg-slate-900/60 dark:border-slate-800">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Layers className="h-3 w-3 text-slate-500" />
            <span>加入目標區塊</span>
          </span>
          <span className="text-[9px] text-slate-700 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded font-mono">
            {targetBand?.type}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setActiveBandDropdown(!activeBandDropdown)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs hover:border-slate-400 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          >
            <div className="flex items-center space-x-2 truncate">
              <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />
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
                  className={`px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    b.id === targetBand?.id
                      ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100'
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

      {/* 2. Controls Toolbox (High-density 2-Column Grid) */}
      <div className="p-2.5 border-b border-slate-200 flex-1 overflow-y-auto dark:border-slate-800 space-y-3">
        {/* Quick Search for controls */}
        <div className="relative">
          <Search className="h-3 w-3 absolute left-2 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋控制項..."
            value={controlSearch}
            onChange={(e) => setControlSearch(e.target.value)}
            className="w-full text-[11px] pl-6 pr-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:border-slate-400 transition-colors shadow-2xs dark:bg-slate-900 dark:border-slate-800"
          />
        </div>

        {categories.map((cat) => (
          <div key={cat.id} className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase flex items-center justify-between px-0.5">
              <span>{cat.name}</span>
              <span className="text-[9px] text-slate-400 font-mono">{cat.controls.length}</span>
            </div>

            {/* 2-Column Compact Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {cat.controls.map((ctrl) => {
                const IconComponent = ctrl.icon;
                const isJustAdded = justAddedControlId === ctrl.type;

                return (
                  <button
                    key={ctrl.type}
                    onClick={() => handleAddControl(ctrl.type)}
                    title={`${ctrl.displayName}：${ctrl.description}`}
                    className="group relative flex items-center space-x-1.5 px-2 py-1.5 rounded-md bg-white border border-slate-200/90 text-left shadow-2xs hover:border-slate-400 hover:bg-slate-50/80 active:scale-[0.98] transition-all dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <div className="p-1 rounded bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900 transition-colors shrink-0 dark:bg-slate-800 dark:text-slate-300">
                      {isJustAdded ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 animate-in zoom-in" />
                      ) : (
                        <IconComponent className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="truncate flex-1">
                      <div className="text-[11px] font-medium text-slate-700 truncate group-hover:text-slate-900 dark:text-slate-200">
                        {ctrl.displayName}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Available Data Fields Explorer (Clean Compact) */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          <span className="flex items-center space-x-1">
            <Database className="h-3.5 w-3.5 text-slate-500" />
            <span>資料集欄位</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {sampleFields.length} 欄
          </span>
        </div>

        {/* Quick Search for fields */}
        {sampleFields.length > 6 && (
          <div className="relative mb-1.5">
            <Search className="h-2.5 w-2.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋資料欄位..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="w-full text-[10px] pl-5.5 pr-2 py-0.5 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors dark:bg-slate-900 dark:border-slate-800"
            />
          </div>
        )}

        {/* Field Chips */}
        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
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
              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              title="點擊新增此欄位至目標區塊"
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
