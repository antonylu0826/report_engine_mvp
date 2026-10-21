import React, { useState } from 'react';
import {
  Database,
  Type,
  Calculator,
  Minus,
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon,
  Image as ImageIcon,
  CheckSquare,
  Square,
  CheckCircle2,
  X,
  Plus,
  Search,
  SlidersHorizontal,
  GripVertical,
  Calendar,
  Hash,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import { controlRegistry } from '@/controls/registry';
import type { ControlType } from '@/types/report';

export const Toolbox: React.FC = () => {
  const {
    report,
    dataSource,
    data,
    addControl,
    selectedBandId,
  } = useReportStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [justAddedControlId, setJustAddedControlId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'params' | 'details'>('all');
  const [expandParams, setExpandParams] = useState(true);
  const [expandDetails, setExpandDetails] = useState(true);

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
      src: defaults.src,
      objectFit: defaults.objectFit,
      checked: defaults.checked,
      checkText: defaults.checkText,
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
    setTimeout(() => setJustAddedControlId(null), 900);
  };

  // Normalized Schema fields (Parameters + Detail Fields)
  const parameters = dataSource?.schema?.parameters || [];
  const detailFields =
    dataSource?.schema?.detailFields ||
    (data && data.length > 0
      ? Object.keys(data[0]).map((key) => ({
          name: key,
          label: key,
          type: 'string' as const,
        }))
      : []);

  const query = fieldSearch.toLowerCase().trim();
  const filteredParameters = query
    ? parameters.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.label.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      )
    : parameters;

  const filteredDetailFields = query
    ? detailFields.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.label.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query)
      )
    : detailFields;

  // Exact original 2-column slim palette (DevExpress/ActiveReports standard)
  const paletteGroups = [
    {
      id: 'basic-and-shapes',
      items: [
        {
          type: 'Label' as ControlType,
          name: '文字標籤 (Label)',
          icon: Type,
        },
        {
          type: 'CheckBox' as ControlType,
          name: '核取方塊 (CheckBox)',
          icon: CheckSquare,
        },
        {
          type: 'Panel' as ControlType,
          name: '面板容器 / 框線 (Panel)',
          icon: Square,
        },
        {
          type: 'Image' as ControlType,
          name: '靜態影像 (Image)',
          icon: ImageIcon,
        },
      ],
    },
    {
      id: 'lines-codes-expressions',
      items: [
        {
          type: 'Line' as ControlType,
          name: '線條 (Line)',
          icon: Minus,
        },
        {
          type: 'Barcode' as ControlType,
          name: '一維條碼 (Barcode - Code128)',
          icon: BarcodeIcon,
        },
        {
          type: 'QRCode' as ControlType,
          name: '二維碼 (QR Code)',
          icon: QrCodeIcon,
        },
        {
          type: 'Expression' as ControlType,
          name: '計算與統計式 (Expression ∑)',
          icon: Calculator,
        },
      ],
    },
  ];

  // Helper: render type pill with color code
  const renderTypeBadge = (type: string, formatHint?: string) => {
    switch (type) {
      case 'number':
        return (
          <span className="inline-flex items-center space-x-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <Hash className="h-2.5 w-2.5 mr-0.5 opacity-70" />
            <span>{formatHint || '數值'}</span>
          </span>
        );
      case 'date':
        return (
          <span className="inline-flex items-center space-x-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
            <Calendar className="h-2.5 w-2.5 mr-0.5 opacity-70" />
            <span>日期</span>
          </span>
        );
      case 'boolean':
        return (
          <span className="inline-flex items-center space-x-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            <CheckSquare className="h-2.5 w-2.5 mr-0.5 opacity-70" />
            <span>布林</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
            <Type className="h-2.5 w-2.5 mr-0.5 opacity-70" />
            <span>字串</span>
          </span>
        );
    }
  };

  return (
    <div className="relative flex select-none z-20">
      {/* 1. Slim 2-Column Icon Palette (56px width, exactly DevExpress/ActiveReports standard - UNTOUCHED) */}
      <aside className="w-14 border-r border-slate-200 bg-white flex flex-col items-center py-2 h-[calc(100vh-3.25rem)] dark:border-slate-800 dark:bg-slate-950 shadow-2xs">
        {/* Top Database Toggle Button for Field List */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors mb-2 ${
            isExpanded
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900'
          }`}
          title={isExpanded ? '收合資料集總管' : '展開資料集總管 (Field Explorer)'}
        >
          <Database className="h-4.5 w-4.5 stroke-[1.8]" />
        </button>

        <div className="w-9 h-[1px] bg-slate-200 dark:bg-slate-800 mb-2" />

        {/* 2-Column Icon Matrix */}
        <div className="flex-1 overflow-y-auto w-full px-1.5 space-y-3">
          {paletteGroups.map((group, gIdx) => (
            <div key={group.id} className="space-y-1">
              <div className="grid grid-cols-2 gap-1 place-items-center">
                {group.items.map((item, idx) => {
                  const Icon = item.icon;
                  const isJustAdded = justAddedControlId === item.type;

                  return (
                    <button
                      key={`${group.id}-${idx}`}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('report-control-type', item.type);
                        e.dataTransfer.setData('text/plain', item.type);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => handleAddControl(item.type)}
                      title={`${item.name}\n(點選加入或直接拖拉至畫布任意位置)`}
                      className="w-5.5 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-2xs active:bg-slate-200 transition-all dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-grab active:cursor-grabbing"
                    >
                      {isJustAdded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 animate-in zoom-in" />
                      ) : (
                        <Icon className="h-4 w-4 stroke-[1.6]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Group Divider line */}
              {gIdx < paletteGroups.length - 1 && (
                <div className="w-full h-[1px] bg-slate-200/80 dark:bg-slate-800 my-1.5" />
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Redesigned Field List Drawer (320px Flyout Explorer for Dataset Fields ONLY) */}
      {isExpanded && (
        <aside className="w-80 border-r border-slate-200 bg-white/98 backdrop-blur-md h-[calc(100vh-3.25rem)] shadow-xl flex flex-col z-30 animate-in slide-in-from-left-2 duration-150 dark:bg-slate-900/95 dark:border-slate-800">
          {/* Drawer Header */}
          <div className="p-3 border-b border-slate-200/80 flex items-center justify-between dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-600 text-white shadow-xs">
                <Database className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    資料集欄位總管
                  </span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                    {parameters.length + detailFields.length}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate">
                  {dataSource?.name || '標準銷貨資料源'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title="關閉資料集總管"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋欄位名稱、key 或說明..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-7 py-1.5 rounded-md border border-slate-200 bg-slate-50/80 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-100"
              />
              {fieldSearch && (
                <button
                  onClick={() => setFieldSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                  title="清除搜尋"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Segmented Filter Tabs */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1 p-0.5 bg-slate-200/60 dark:bg-slate-800 rounded-md w-full">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex-1 py-1 rounded text-center font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                全部 ({filteredParameters.length + filteredDetailFields.length})
              </button>
              <button
                onClick={() => setActiveCategory('params')}
                className={`flex-1 py-1 rounded text-center font-medium transition-all ${
                  activeCategory === 'params'
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                單頭 ({filteredParameters.length})
              </button>
              <button
                onClick={() => setActiveCategory('details')}
                className={`flex-1 py-1 rounded text-center font-medium transition-all ${
                  activeCategory === 'details'
                    ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-700 dark:text-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                明細 ({filteredDetailFields.length})
              </button>
            </div>
          </div>

          {/* Fields List with Collapsible Groups & Rich Micro-Cards */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
            {/* Group 1: Parameters (Master / Header) */}
            {(activeCategory === 'all' || activeCategory === 'params') &&
              filteredParameters.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setExpandParams(!expandParams)}
                    className="w-full flex items-center justify-between px-1 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-1.5">
                      {expandParams ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <SlidersHorizontal className="h-3 w-3" />
                      <span>單頭主檔參數</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                      {filteredParameters.length}
                    </span>
                  </button>

                  {expandParams && (
                    <div className="space-y-1.5">
                      {filteredParameters.map((param) => {
                        const sampleVal =
                          dataSource?.data?.parameters?.[param.name] ??
                          param.sampleValue;
                        const sampleStr =
                          typeof sampleVal === 'boolean'
                            ? sampleVal
                              ? 'true (已核選)'
                              : 'false (未核選)'
                            : String(sampleVal ?? '');

                        return (
                          <div
                            key={param.name}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('report-control-type', 'Field');
                              e.dataTransfer.setData('report-field-name', param.name);
                              e.dataTransfer.setData('text/plain', `[${param.name}]`);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="group relative flex items-start justify-between p-2 rounded-lg bg-white border border-slate-200/80 hover:border-blue-400/80 hover:shadow-sm hover:bg-blue-50/20 transition-all cursor-grab active:cursor-grabbing select-none dark:bg-slate-900/80 dark:border-slate-800 dark:hover:border-blue-600"
                            title={`${param.description || param.label} - 按住拖曳至畫布`}
                          >
                            <div className="flex items-start space-x-1.5 min-w-0 flex-1">
                              <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                    {param.label}
                                  </span>
                                  {renderTypeBadge(param.type)}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                  [{param.name}]
                                </span>
                                {sampleStr && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 bg-slate-50 dark:bg-slate-800/60 px-1 py-0.2 rounded border border-slate-100 dark:border-slate-700/60">
                                    值: <span className="font-mono text-slate-700 dark:text-slate-300">{sampleStr}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const target =
                                  targetBand ||
                                  report.bands.find((b) => b.type === 'ReportHeader') ||
                                  report.bands[0];
                                if (target) {
                                  addControl(target.id, {
                                    type: param.type === 'boolean' ? 'CheckBox' : 'Field',
                                    x: 20,
                                    y: 6,
                                    width: param.type === 'boolean' ? 110 : 130,
                                    height: 16,
                                    fieldName: param.name,
                                    text: param.label,
                                    style: { fontSize: 9, color: '#0f172a' },
                                  });
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-100/80 transition-all dark:hover:bg-blue-900 shrink-0"
                              title={`快速加入 [${param.name}] 至 ${targetBand?.type || 'ReportHeader'}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            {/* Group 2: Detail List Fields */}
            {(activeCategory === 'all' || activeCategory === 'details') &&
              filteredDetailFields.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setExpandDetails(!expandDetails)}
                    className="w-full flex items-center justify-between px-1 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-1.5">
                      {expandDetails ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Database className="h-3 w-3" />
                      <span>明細列資料欄位</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {filteredDetailFields.length}
                    </span>
                  </button>

                  {expandDetails && (
                    <div className="space-y-1.5">
                      {filteredDetailFields.map((field) => {
                        const sampleVal =
                          dataSource?.data?.items?.[0]?.[field.name] ??
                          field.sampleValue;
                        const sampleStr =
                          typeof sampleVal === 'boolean'
                            ? sampleVal
                              ? 'true (已點收)'
                              : 'false (未點收)'
                            : typeof sampleVal === 'number' && field.formatHint === 'C0'
                            ? `NT$ ${sampleVal.toLocaleString()}`
                            : String(sampleVal ?? '');

                        return (
                          <div
                            key={field.name}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('report-control-type', 'Field');
                              e.dataTransfer.setData('report-field-name', field.name);
                              e.dataTransfer.setData('text/plain', `[${field.name}]`);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="group relative flex items-start justify-between p-2 rounded-lg bg-white border border-slate-200/80 hover:border-emerald-400/80 hover:shadow-sm hover:bg-emerald-50/20 transition-all cursor-grab active:cursor-grabbing select-none dark:bg-slate-900/80 dark:border-slate-800 dark:hover:border-emerald-600"
                            title={`${field.description || field.label} - 按住拖曳至畫布`}
                          >
                            <div className="flex items-start space-x-1.5 min-w-0 flex-1">
                              <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-500 shrink-0 mt-0.5 transition-colors" />
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                    {field.label}
                                  </span>
                                  {renderTypeBadge(field.type, field.formatHint)}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                  [{field.name}]
                                </span>
                                {sampleStr && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 bg-slate-50 dark:bg-slate-800/60 px-1 py-0.2 rounded border border-slate-100 dark:border-slate-700/60">
                                    值: <span className="font-mono text-slate-700 dark:text-slate-300">{sampleStr}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                const target =
                                  targetBand ||
                                  report.bands.find((b) => b.type === 'Detail') ||
                                  report.bands[0];
                                if (target) {
                                  addControl(target.id, {
                                    type: field.type === 'boolean' ? 'CheckBox' : 'Field',
                                    x: 30,
                                    y: 4,
                                    width: field.type === 'boolean' ? 80 : 100,
                                    height: 14,
                                    fieldName: field.name,
                                    formatString: field.formatHint,
                                    text: field.label,
                                    style: {
                                      fontSize: 9,
                                      color: '#0f172a',
                                      textAlign: field.type === 'number' ? 'right' : 'left',
                                    },
                                  });
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-100/80 transition-all dark:hover:bg-emerald-900 shrink-0"
                              title={`快速加入 [${field.name}] 至 ${targetBand?.type || 'Detail'}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            {filteredParameters.length === 0 && filteredDetailFields.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                找不到相符的欄位名稱「{fieldSearch}」
              </div>
            )}
          </div>

          {/* Drawer Footer Status */}
          <div className="p-2.5 border-t border-slate-200/80 bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>明細筆數：{data?.length || 14} 筆</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              按住卡片直接拖放
            </span>
          </div>
        </aside>
      )}
    </div>
  );
};
