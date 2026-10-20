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
  } = useReportStore();

  const [isExpanded, setIsExpanded] = useState(false);
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

  // Sample dataset fields
  const sampleFields = data && data.length > 0 ? Object.keys(data[0]) : [];
  const filteredFields = fieldSearch
    ? sampleFields.filter((f) => f.toLowerCase().includes(fieldSearch.toLowerCase()))
    : sampleFields;

  // Fully implemented 8-control palette (DevExpress 2-column layout)
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

  return (
    <div className="relative flex select-none z-20">
      {/* Slim 2-Column Icon Palette (56px width, exactly like DevExpress/ActiveReports) */}
      <aside className="w-14 border-r border-slate-200 bg-white flex flex-col items-center py-2 h-[calc(100vh-3.25rem)] dark:border-slate-800 dark:bg-slate-950 shadow-2xs">
        {/* Top Database Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors mb-2 ${
            isExpanded
              ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900'
          }`}
          title={isExpanded ? '收合資料欄位抽屜' : '展開資料欄位抽屜 (Field Explorer)'}
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

      {/* Flyout Drawer for Data Fields & Search (Toggle with Hamburger ≡) */}
      {isExpanded && (
        <aside className="w-64 border-r border-slate-200 bg-white/95 backdrop-blur h-[calc(100vh-3.25rem)] shadow-lg flex flex-col z-30 animate-in slide-in-from-left-2 duration-150 dark:bg-slate-900/95 dark:border-slate-800">
          {/* Drawer Header */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Database className="h-4 w-4 text-slate-500" />
              <span>資料集欄位總管 (Field List)</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="搜尋欄位名稱..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-2 py-1 rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-400 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono px-1 mb-1">
              可綁定欄位 ({filteredFields.length})
            </div>
            {filteredFields.map((field) => (
              <div
                key={field}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('report-control-type', 'Field');
                  e.dataTransfer.setData('report-field-name', field);
                  e.dataTransfer.setData('text/plain', `[${field}]`);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="group flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-slate-100 border border-transparent hover:border-slate-200 text-xs transition-colors dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing select-none"
                title={`按住拖拉 [${field}] 至畫布或點選右側 + 加入`}
              >
                <div className="flex items-center space-x-2 truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  <Database className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate">{field}</span>
                </div>
                <button
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
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition-all dark:hover:text-slate-100 dark:hover:bg-slate-700"
                  title={`加入 [${field}] 至 ${targetBand?.type || 'Detail'}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
};
