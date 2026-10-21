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
  Calendar,
  Hash,
  ChevronDown,
  ChevronRight,
  TableProperties,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import { controlRegistry } from '@/controls/registry';
import type { ControlType, BandType } from '@/types/report';
import { BAND_NAMES, CONTROL_NAMES, DATA_TYPE_NAMES } from '@/constants/labels';

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
          name: CONTROL_NAMES.Label,
          icon: Type,
        },
        {
          type: 'CheckBox' as ControlType,
          name: CONTROL_NAMES.CheckBox,
          icon: CheckSquare,
        },
        {
          type: 'Panel' as ControlType,
          name: CONTROL_NAMES.Panel,
          icon: Square,
        },
        {
          type: 'Image' as ControlType,
          name: CONTROL_NAMES.Image,
          icon: ImageIcon,
        },
      ],
    },
    {
      id: 'lines-codes-expressions',
      items: [
        {
          type: 'Line' as ControlType,
          name: CONTROL_NAMES.Line,
          icon: Minus,
        },
        {
          type: 'Barcode' as ControlType,
          name: CONTROL_NAMES.Barcode,
          icon: BarcodeIcon,
        },
        {
          type: 'QRCode' as ControlType,
          name: CONTROL_NAMES.QRCode,
          icon: QrCodeIcon,
        },
        {
          type: 'Expression' as ControlType,
          name: CONTROL_NAMES.Expression,
          icon: Calculator,
        },
        {
          type: 'SubReport' as ControlType,
          name: CONTROL_NAMES.SubReport,
          icon: TableProperties,
        },
      ],
    },
  ];

  // Helper: render compact type icon
  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'number':
        return <Hash className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'date':
        return <Calendar className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />;
      case 'boolean':
        return <CheckSquare className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />;
      case 'array':
        return <TableProperties className="h-3 w-3 text-cyan-600 dark:text-cyan-400 shrink-0" />;
      default:
        return <Type className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />;
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

      {/* 2. Simplified Clean Field List Drawer (256px Compact Tree List) */}
      {isExpanded && (
        <aside className="w-64 border-r border-slate-200 bg-white h-[calc(100vh-3.25rem)] shadow-lg flex flex-col z-30 animate-in slide-in-from-left-2 duration-150 dark:bg-slate-950 dark:border-slate-800">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 min-w-0">
              <Database className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate">資料集總管</span>
              <span className="text-[10px] font-mono text-slate-400">
                ({parameters.length + detailFields.length})
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              title="關閉"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋欄位..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-6 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
              {fieldSearch && (
                <button
                  onClick={() => setFieldSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Compact List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-2">
            {/* Group 1: Parameters */}
            {filteredParameters.length > 0 && (
              <div>
                <button
                  onClick={() => setExpandParams(!expandParams)}
                  className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center space-x-1">
                    {expandParams ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span>單頭主檔參數</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredParameters.length}
                  </span>
                </button>

                {expandParams && (
                  <div className="space-y-0.5 mt-0.5">
                    {filteredParameters.map((param) => {
                      const sampleVal = dataSource?.data?.parameters?.[param.name];
                      const typeZh = DATA_TYPE_NAMES[param.type] || param.type;
                      const sampleTooltip = `[${param.name}] ${param.label}\n型別: ${typeZh}${sampleVal !== undefined ? `\n範例值: ${sampleVal}` : ''}\n按住可拖曳至畫布`;

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
                          title={sampleTooltip}
                          className="group flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                            {renderTypeIcon(param.type)}
                            <span className="truncate text-slate-700 dark:text-slate-200 text-[11px]">
                              {param.label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 truncate">
                              {param.name}
                            </span>
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
                                  width: param.type === 'boolean' ? 100 : 120,
                                  height: 16,
                                  fieldName: param.name,
                                  text: param.label,
                                  style: { fontSize: 9, color: '#0f172a' },
                                });
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-all dark:hover:bg-slate-700 shrink-0"
                            title={`加入至 ${BAND_NAMES[targetBand?.type as BandType] || '報表表頭'}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Group 2: Detail Fields */}
            {filteredDetailFields.length > 0 && (
              <div>
                <button
                  onClick={() => setExpandDetails(!expandDetails)}
                  className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center space-x-1">
                    {expandDetails ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span>明細列欄位</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredDetailFields.length}
                  </span>
                </button>

                {expandDetails && (
                  <div className="space-y-0.5 mt-0.5">
                    {filteredDetailFields.map((field) => {
                      const sampleVal = dataSource?.data?.items?.[0]?.[field.name];
                      const typeZh = DATA_TYPE_NAMES[field.type] || field.type;
                      const sampleTooltip = `[${field.name}] ${field.label}\n型別: ${typeZh}${sampleVal !== undefined ? `\n範例值: ${sampleVal}` : ''}\n按住可拖曳至畫布`;

                      return (
                        <div key={field.name} className="flex flex-col">
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('report-control-type', field.type === 'array' ? 'SubReport' : 'Field');
                              e.dataTransfer.setData('report-field-name', field.name);
                              e.dataTransfer.setData('text/plain', `[${field.name}]`);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            title={sampleTooltip}
                            className="group flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-emerald-50 dark:hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                              {renderTypeIcon(field.type)}
                              <span className="truncate text-slate-700 dark:text-slate-200 text-[11px]">
                                {field.label}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 truncate">
                                {field.name}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const target =
                                  targetBand ||
                                  report.bands.find((b) => b.type === 'Detail') ||
                                  report.bands[0];
                                if (target) {
                                  if (field.type === 'array') {
                                    addControl(target.id, {
                                      type: 'SubReport',
                                      x: 0,
                                      y: 22,
                                      width: 515,
                                      height: 38,
                                      subReportTitle: field.label,
                                      subReportBinding: field.name,
                                    });
                                  } else {
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
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded transition-all dark:hover:bg-slate-700 shrink-0"
                              title={`加入至 ${BAND_NAMES[targetBand?.type as BandType] || '明細區'}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Nested Sub-fields preview if this is an array field */}
                          {field.children && field.children.length > 0 && (
                            <div className="ml-5 pl-2.5 py-1 mb-1 border-l-2 border-cyan-400/80 bg-cyan-50/30 dark:bg-slate-900/40 rounded-r space-y-0.5">
                              <span className="text-[9px] font-semibold text-cyan-800 dark:text-cyan-300 block">
                                子清單欄位 (一對多)：
                              </span>
                              {field.children.map((child) => (
                                <div
                                  key={child.name}
                                  className="flex items-center space-x-1.5 text-[9.5px] text-slate-600 dark:text-slate-300 font-mono"
                                >
                                  <span className="text-cyan-500">↳</span>
                                  <span className="font-sans font-medium text-slate-700 dark:text-slate-200">
                                    {child.label}
                                  </span>
                                  <span className="text-[8.5px] text-slate-400">
                                    ({child.name})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {filteredParameters.length === 0 && filteredDetailFields.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                無相符欄位「{fieldSearch}」
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
