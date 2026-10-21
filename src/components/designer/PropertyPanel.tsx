import React from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Trash2,
  SlidersHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Minus,
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon,
  Upload,
  Layers,
  ArrowDownUp,
  FileText,
  Compass,
  TableProperties,
} from 'lucide-react';
import { controlRegistry } from '@/controls/registry';
import type { PageSize, PageOrientation, BandType } from '@/types/report';
import { BAND_NAMES, CONTROL_NAMES, ORIENTATION_NAMES } from '@/constants/labels';

export const PropertyPanel: React.FC = () => {
  const {
    report,
    data,
    selectedBandId,
    selectedControlId,
    updateControl,
    removeControl,
    updateBandHeight,
    setReport,
    editingSubReportPath,
    getActiveReport,
  } = useReportStore();

  const activeReport = getActiveReport();
  const selectedBand = activeReport.bands.find((b) => b.id === selectedBandId);
  const selectedControl = selectedBand?.controls.find((c) => c.id === selectedControlId);

  // Sample dataset fields for auto-suggest
  const sampleFields = (() => {
    if (editingSubReportPath) {
      // SubReport nested field suggestions from mock sample items
      const nestedSample = data?.[0]?.serials as Record<string, unknown>[] | undefined;
      if (nestedSample && nestedSample.length > 0) {
        return Object.keys(nestedSample[0]);
      }
      return ['serialNo', 'lotNo', 'location', 'qcStatus'];
    }
    return data && data.length > 0 ? Object.keys(data[0]) : [];
  })();

  // Update Band properties (e.g. groupBy, pageBreakAfter)
  const updateBandProp = (patch: Record<string, unknown>) => {
    if (!selectedBand) return;
    const updatedBands = report.bands.map((b) =>
      b.id === selectedBand.id ? { ...b, ...patch } : b
    );
    setReport({ ...report, bands: updatedBands });
  };

  // Update Global Report Settings (when nothing is selected)
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

  // Active Control Plugin & Metadata
  const controlPlugin = selectedControl ? controlRegistry.get(selectedControl.type) : null;
  const ControlIcon = controlPlugin?.icon || SlidersHorizontal;

  // Determine capabilities
  const isTextCapable = selectedControl
    ? ['Label', 'Field', 'Expression', 'CheckBox'].includes(selectedControl.type)
    : false;
  const isBackgroundCapable = selectedControl
    ? ['Label', 'Field', 'Expression', 'Panel'].includes(selectedControl.type)
    : false;

  // 1. GLOBAL REPORT SETTINGS VIEW (When nothing is selected)
  if (!selectedBand && !selectedControl) {
    return (
      <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950 shadow-2xs overflow-y-auto">
        <div className="p-3 border-b border-slate-200 flex items-center space-x-1.5 dark:border-slate-800">
          <FileText className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            報表與版面設定
          </span>
        </div>

        <div className="p-3 space-y-4 text-xs">
          {/* Report Name */}
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-500">報表名稱</Label>
            <Input
              value={report.name}
              onChange={(e) => setReport({ ...report, name: e.target.value })}
              className="font-medium"
            />
          </div>

          {/* Page Size & Orientation */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              紙張與列印方向
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-slate-500">紙張規格</Label>
                <select
                  value={report.pageSettings.size}
                  onChange={(e) => updatePageSettings({ size: e.target.value as PageSize })}
                  className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">Letter (8.5 × 11 in)</option>
                </select>
              </div>

              <div>
                <Label className="text-[10px] text-slate-500">版面方向</Label>
                <select
                  value={report.pageSettings.orientation}
                  onChange={(e) =>
                    updatePageSettings({ orientation: e.target.value as PageOrientation })
                  }
                  className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-800 font-medium"
                >
                  <option value="portrait">{ORIENTATION_NAMES.portrait}</option>
                  <option value="landscape">{ORIENTATION_NAMES.landscape}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                頁面邊界 (pt)
              </span>
              <span className="text-[9px] text-slate-400 font-mono">1 pt = 1/72 in</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-slate-500">上邊界</Label>
                <Input
                  type="number"
                  value={report.pageSettings.margins.top}
                  onChange={(e) => updatePageMargins({ top: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">下邊界</Label>
                <Input
                  type="number"
                  value={report.pageSettings.margins.bottom}
                  onChange={(e) => updatePageMargins({ bottom: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">左邊界</Label>
                <Input
                  type="number"
                  value={report.pageSettings.margins.left}
                  onChange={(e) => updatePageMargins({ left: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">右邊界</Label>
                <Input
                  type="number"
                  value={report.pageSettings.margins.right}
                  onChange={(e) => updatePageMargins({ right: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Helper Tips */}
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 space-y-1">
            <div className="flex items-center space-x-1 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
              <Compass className="h-3.5 w-3.5 text-slate-500" />
              <span>操作小提示</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              點選畫布上的任何控制項或報表區段，即可於此處檢視與設定個別物件專屬座標、資料綁定與樣式。
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // 2. CONTROL OR BAND INSPECTOR VIEW
  return (
    <aside className="w-72 border-l border-slate-200 bg-white flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950 shadow-2xs overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider dark:text-slate-300">
            屬性面板
          </span>
        </div>

        {selectedControl && selectedBand && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeControl(selectedBand.id, selectedControl.id)}
            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            title="刪除此控制項"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* Selected Object Tag with Dynamic Plugin Info */}
        <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">目前選取物件</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 mt-0.5">
            {selectedControl ? (
              <>
                <ControlIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>{CONTROL_NAMES[selectedControl.type] || `${selectedControl.type} 控制項`}</span>
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                <span>{BAND_NAMES[selectedBand?.type as BandType] || `${selectedBand?.type} 區段`}</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
            ID: {selectedControl?.id || selectedBand?.id}
          </div>
        </div>

        {/* Control Specific Properties */}
        {selectedControl && selectedBand && (
          <>
            {/* 1. Geometry (Position & Size) */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                座標與尺寸 (pt)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-500">水平座標 X</Label>
                  <Input
                    type="number"
                    value={selectedControl.x}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        x: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">垂直座標 Y</Label>
                  <Input
                    type="number"
                    value={selectedControl.y}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        y: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">寬度</Label>
                  <Input
                    type="number"
                    value={selectedControl.width}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        width: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">高度</Label>
                  <Input
                    type="number"
                    value={selectedControl.height}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        height: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 2. Data & Content Settings */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                資料與內容設定
              </span>

              {/* Label */}
              {selectedControl.type === 'Label' && (
                <div>
                  <Label className="text-[10px] text-slate-500">文字內容</Label>
                  <Input
                    value={selectedControl.text ?? ''}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        text: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {/* Field (with auto-suggest dropdown) */}
              {selectedControl.type === 'Field' && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-500">資料欄位名稱</Label>
                  <div className="flex space-x-1">
                    <Input
                      value={selectedControl.fieldName ?? ''}
                      placeholder="如 sku, amount, category"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          fieldName: e.target.value,
                        })
                      }
                      className="flex-1 font-mono text-xs"
                    />
                    {sampleFields.length > 0 && (
                      <select
                        value={selectedControl.fieldName || ''}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            fieldName: e.target.value,
                          })
                        }
                        className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800"
                        title="快速套用欄位"
                      >
                        <option value="">選擇欄位▾</option>
                        {sampleFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {/* Expression */}
              {selectedControl.type === 'Expression' && (
                <div>
                  <Label className="text-[10px] text-slate-500">計算運算式</Label>
                  <Input
                    value={selectedControl.expression ?? ''}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        expression: e.target.value,
                      })
                    }
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    支援 =SUM(amount)、=COUNT()、[PageNumber]
                  </p>
                </div>
              )}

              {/* Line Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'Line' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <Minus className="h-3.5 w-3.5 text-slate-500" />
                    <span>線條樣式</span>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">線條方向</Label>
                    <select
                      value={selectedControl.lineOrientation || 'horizontal'}
                      onChange={(e) => {
                        const isVert = e.target.value === 'vertical';
                        updateControl(selectedBand.id, selectedControl.id, {
                          lineOrientation: isVert ? 'vertical' : 'horizontal',
                          width: isVert ? 1 : 515,
                          height: isVert ? 30 : 1,
                        });
                      }}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="horizontal">水平</option>
                      <option value="vertical">垂直</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">線條色彩</Label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="color"
                        value={selectedControl.style?.color || '#cbd5e1'}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: { ...selectedControl.style, color: e.target.value },
                          })
                        }
                        className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      />
                      <Input
                        value={selectedControl.style?.color || '#cbd5e1'}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: { ...selectedControl.style, color: e.target.value },
                          })
                        }
                        className="text-[11px] font-mono h-7"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Image Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'Image' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span>圖片來源與縮放</span>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">圖片網址</Label>
                    <Input
                      value={selectedControl.src ?? ''}
                      placeholder="https://... 或 Base64"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          src: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Local Image File Upload */}
                  <div>
                    <Label className="text-[10px] text-slate-500">或上傳本機圖檔</Label>
                    <label className="flex items-center justify-center space-x-1.5 px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 cursor-pointer text-[11px] shadow-2xs transition-colors">
                      <Upload className="h-3.5 w-3.5 text-slate-500" />
                      <span>選擇圖檔...</span>
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
                              updateControl(selectedBand.id, selectedControl.id, {
                                src: result,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">縮放方式</Label>
                    <select
                      value={selectedControl.objectFit || 'contain'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          objectFit: e.target.value as 'contain' | 'cover' | 'fill',
                        })
                      }
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="contain">等比完整容納 (推薦)</option>
                      <option value="cover">等比填滿裁切</option>
                      <option value="fill">填滿變形</option>
                    </select>
                  </div>
                </div>
              )}

              {/* CheckBox Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'CheckBox' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
                    <span>核取方塊設定</span>
                  </div>

                  <label className="flex items-center space-x-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selectedControl.checked}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          checked: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300"
                    />
                    <span>預設勾選</span>
                  </label>

                  <div>
                    <Label className="text-[10px] text-slate-500">標籤文字</Label>
                    <Input
                      value={selectedControl.checkText ?? ''}
                      placeholder="如 核取項目、已發貨"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          checkText: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">或綁定布林欄位</Label>
                    <div className="flex space-x-1">
                      <Input
                        value={selectedControl.fieldName ?? ''}
                        placeholder="如 isPaid, inStock"
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            fieldName: e.target.value,
                          })
                        }
                        className="flex-1 font-mono text-xs"
                      />
                      {sampleFields.length > 0 && (
                        <select
                          value={selectedControl.fieldName || ''}
                          onChange={(e) =>
                            updateControl(selectedBand.id, selectedControl.id, {
                              fieldName: e.target.value,
                            })
                          }
                          className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800"
                          title="快速套用欄位"
                        >
                          <option value="">選擇欄位▾</option>
                          {sampleFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Panel Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'Panel' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <Square className="h-3.5 w-3.5 text-slate-500" />
                    <span>面板框線與圓角</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-500">框線粗細 (pt)</Label>
                      <Input
                        type="number"
                        value={selectedControl.style?.borderWidth ?? 1}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: {
                              ...selectedControl.style,
                              borderWidth: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">圓角大小 (pt)</Label>
                      <Input
                        type="number"
                        value={selectedControl.style?.borderRadius ?? 0}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: {
                              ...selectedControl.style,
                              borderRadius: Number(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">外框線條色彩</Label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="color"
                        value={selectedControl.style?.borderColor || '#cbd5e1'}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: { ...selectedControl.style, borderColor: e.target.value },
                          })
                        }
                        className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      />
                      <Input
                        value={selectedControl.style?.borderColor || '#cbd5e1'}
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            style: { ...selectedControl.style, borderColor: e.target.value },
                          })
                        }
                        className="text-[11px] font-mono h-7"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Barcode Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'Barcode' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <BarcodeIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span>條碼格式與編碼</span>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">條碼碼別</Label>
                    <select
                      value={selectedControl.barcodeFormat || 'CODE128'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          barcodeFormat: e.target.value as 'CODE128' | 'EAN13' | 'UPC' | 'CODE39',
                        })
                      }
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="CODE128">Code 128 (標準物流碼)</option>
                      <option value="EAN13">EAN-13 (國際商品條碼)</option>
                      <option value="UPC">UPC-A (商品條碼)</option>
                      <option value="CODE39">Code 39 (工業條碼)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">靜態條碼內容 (預設)</Label>
                    <Input
                      value={selectedControl.text ?? ''}
                      placeholder="如 ORD-20261020-0089"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          text: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">或動態綁定欄位</Label>
                    <div className="flex space-x-1">
                      <Input
                        value={selectedControl.fieldName ?? ''}
                        placeholder="如 sku, orderNo"
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            fieldName: e.target.value,
                          })
                        }
                        className="flex-1 font-mono text-xs"
                      />
                      {sampleFields.length > 0 && (
                        <select
                          value={selectedControl.fieldName || ''}
                          onChange={(e) =>
                            updateControl(selectedBand.id, selectedControl.id, {
                              fieldName: e.target.value,
                            })
                          }
                          className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800"
                          title="快速套用欄位"
                        >
                          <option value="">選擇欄位▾</option>
                          {sampleFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <label className="flex items-center space-x-2 text-[11px] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={selectedControl.displayValue ?? true}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          displayValue: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300"
                    />
                    <span>顯示條碼下方文字編號</span>
                  </label>
                </div>
              )}

              {/* QRCode Specific Inspector (Neutral Slate) */}
              {selectedControl.type === 'QRCode' && (
                <div className="space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold text-[11px]">
                    <QrCodeIcon className="h-3.5 w-3.5 text-slate-500" />
                    <span>二維碼設定</span>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">容錯率等級</Label>
                    <select
                      value={selectedControl.qrErrorLevel || 'M'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          qrErrorLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
                        })
                      }
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="L">L (7% 低容錯)</option>
                      <option value="M">M (15% 中等容錯)</option>
                      <option value="Q">Q (25% 高容錯)</option>
                      <option value="H">H (30% 最高容錯)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">QR Code 靜態內容/網址</Label>
                    <Input
                      value={selectedControl.text ?? ''}
                      placeholder="https://..."
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          text: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">或動態綁定欄位</Label>
                    <div className="flex space-x-1">
                      <Input
                        value={selectedControl.fieldName ?? ''}
                        placeholder="如 trackingUrl, sku"
                        onChange={(e) =>
                          updateControl(selectedBand.id, selectedControl.id, {
                            fieldName: e.target.value,
                          })
                        }
                        className="flex-1 font-mono text-xs"
                      />
                      {sampleFields.length > 0 && (
                        <select
                          value={selectedControl.fieldName || ''}
                          onChange={(e) =>
                            updateControl(selectedBand.id, selectedControl.id, {
                              fieldName: e.target.value,
                            })
                          }
                          className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800"
                          title="快速套用欄位"
                        >
                          <option value="">選擇欄位▾</option>
                          {sampleFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SubReport Specific Inspector */}
              {selectedControl.type === 'SubReport' && (
                <div className="space-y-2.5 bg-blue-50/60 p-2.5 rounded-md border border-blue-200 dark:bg-slate-900 dark:border-blue-900/50">
                  <div className="flex items-center space-x-1.5 text-blue-900 dark:text-blue-200 font-semibold text-[11px]">
                    <TableProperties className="h-3.5 w-3.5 text-blue-600" />
                    <span>子報表 (SubReport) 一對多設定</span>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">子報表標題備註</Label>
                    <Input
                      value={selectedControl.subReportTitle ?? ''}
                      placeholder="如 產品出廠序號與品檢明細"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          subReportTitle: e.target.value,
                        })
                      }
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">綁定父列子陣列欄位 (Data Binding)</Label>
                    <Input
                      value={selectedControl.subReportBinding ?? ''}
                      placeholder="如 serials, components, logs"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          subReportBinding: e.target.value,
                        })
                      }
                      className="font-mono text-xs"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">
                      將自動從明細每筆紀錄中提取此陣列（例如 <code>currentRow.serials</code>）並展開呈現在該項目下方。
                    </p>
                  </div>

                  <div className="pt-2 border-t border-blue-200/80">
                    <Button
                      size="sm"
                      onClick={() => {
                        const state = useReportStore.getState();
                        state.enterSubReportEditor(selectedBand.id, selectedControl.id);
                      }}
                      className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <TableProperties className="h-3.5 w-3.5" />
                      <span>開啟子報表次級畫布 (Bands 排版)</span>
                    </Button>
                    <p className="text-[8.5px] text-slate-500 text-center mt-1">
                      自由增刪控制項、欄位、條碼與調整子表頭/明細區段高
                    </p>
                  </div>
                </div>
              )}

              {/* Format String for text controls */}
              {['Field', 'Expression'].includes(selectedControl.type) && (
                <div>
                  <Label className="text-[10px] text-slate-500">數值格式化</Label>
                  <Input
                    value={selectedControl.formatString ?? ''}
                    placeholder="如 C0 (金額貨幣), N0 (整數), date (日期)"
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        formatString: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* 3. Typography & Styling (Conditionally Shown for Text-capable Controls) */}
            {isTextCapable && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  文字排版與外觀
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">字型大小 (pt)</Label>
                    <Input
                      type="number"
                      value={selectedControl.style?.fontSize ?? 9}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          style: {
                            ...selectedControl.style,
                            fontSize: Number(e.target.value) || 9,
                          },
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">對齊方式</Label>
                    <div className="flex border border-slate-200 rounded-md overflow-hidden dark:border-slate-800">
                      {(['left', 'center', 'right'] as const).map((align) => (
                        <button
                          key={align}
                          onClick={() =>
                            updateControl(selectedBand.id, selectedControl.id, {
                              style: { ...selectedControl.style, textAlign: align },
                            })
                          }
                          className={`flex-1 p-1.5 flex justify-center items-center ${
                            (selectedControl.style?.textAlign || 'left') === align
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
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">文字粗體</span>
                  <button
                    onClick={() =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        style: {
                          ...selectedControl.style,
                          fontWeight: selectedControl.style?.fontWeight === 'bold' ? 'normal' : 'bold',
                        },
                      })
                    }
                    className={`p-1.5 rounded-md border text-xs flex items-center space-x-1 ${
                      selectedControl.style?.fontWeight === 'bold'
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Bold className="h-3 w-3" />
                    <span className="text-[10px]">粗體</span>
                  </button>
                </div>

                {/* Text Color */}
                <div>
                  <Label className="text-[10px] text-slate-500">文字色彩</Label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="color"
                      value={selectedControl.style?.color || '#0f172a'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          style: { ...selectedControl.style, color: e.target.value },
                        })
                      }
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                    />
                    <Input
                      value={selectedControl.style?.color || '#0f172a'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          style: { ...selectedControl.style, color: e.target.value },
                        })
                      }
                      className="text-[11px] font-mono h-7"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Background Color (Conditionally Shown for Container/Text Controls) */}
            {isBackgroundCapable && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  背景填色
                </span>
                <div className="flex items-center space-x-1">
                  <input
                    type="color"
                    value={selectedControl.style?.backgroundColor || '#ffffff'}
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        style: {
                          ...selectedControl.style,
                          backgroundColor: e.target.value,
                        },
                      })
                    }
                    className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                  />
                  <Input
                    value={selectedControl.style?.backgroundColor || ''}
                    placeholder="透明"
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        style: {
                          ...selectedControl.style,
                          backgroundColor: e.target.value,
                        },
                      })
                    }
                    className="text-[11px] font-mono h-7 flex-1"
                  />
                  {selectedControl.style?.backgroundColor && (
                    <button
                      onClick={() =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          style: {
                            ...selectedControl.style,
                            backgroundColor: undefined,
                          },
                        })
                      }
                      className="text-[10px] text-slate-500 hover:text-slate-800 underline px-1"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Band Specific Properties */}
        {!selectedControl && selectedBand && (
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-slate-500">區段高度 (pt)</Label>
              <Input
                type="number"
                value={selectedBand.height}
                onChange={(e) =>
                  updateBandHeight(selectedBand.id, Number(e.target.value) || 20)
                }
              />
            </div>

            {/* Grouping Settings for GroupHeader / GroupFooter (Neutral Slate) */}
            {['GroupHeader', 'GroupFooter'].includes(selectedBand.type) && (
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-2 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                  <span>分組小計與換頁設定</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-600">分組依據欄位</Label>
                  <div className="flex space-x-1">
                    <Input
                      value={selectedBand.groupBy ?? ''}
                      placeholder="如 category 或 customerName"
                      onChange={(e) => updateBandProp({ groupBy: e.target.value })}
                      className="flex-1 font-mono text-xs"
                    />
                    {sampleFields.length > 0 && (
                      <select
                        value={selectedBand.groupBy || ''}
                        onChange={(e) => updateBandProp({ groupBy: e.target.value })}
                        className="w-24 text-[10px] font-mono rounded border border-slate-300 p-1 bg-white dark:bg-slate-800"
                        title="快速挑選分組欄位"
                      >
                        <option value="">選擇欄位▾</option>
                        {sampleFields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500">
                    資料列將依據此欄位進行彙總分組小計
                  </p>
                </div>

                <div>
                  <Label className="text-[10px] text-slate-600">分組排序順序</Label>
                  <select
                    value={selectedBand.groupSortOrder || 'asc'}
                    onChange={(e) =>
                      updateBandProp({ groupSortOrder: e.target.value as 'asc' | 'desc' })
                    }
                    className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                  >
                    <option value="asc">升冪排序</option>
                    <option value="desc">降冪排序</option>
                  </select>
                </div>

                <div className="pt-1 space-y-1">
                  <label className="flex items-center space-x-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBand.pageBreakAfter ?? false}
                      onChange={(e) => updateBandProp({ pageBreakAfter: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <span className="flex items-center space-x-1">
                      <ArrowDownUp className="h-3 w-3 text-slate-500" />
                      <span>分組後自動換頁</span>
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('確定要移除此分組結構 (包含群組表頭與小計) 嗎？')) {
                        const updated = report.bands.filter(
                          (b) => b.type !== 'GroupHeader' && b.type !== 'GroupFooter'
                        );
                        setReport({ ...report, bands: updated });
                      }
                    }}
                    className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-7"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    <span>移除此分組結構</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-md bg-white border border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
              <div className="text-[11px] font-medium mb-1">
                跨頁不分割
              </div>
              <p className="text-[10px] text-slate-400">
                {selectedBand.keepTogether
                  ? '已啟用：避免此區段在跨頁邊界被截斷'
                  : '未啟用：允許此區段內容自然跨頁'}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
