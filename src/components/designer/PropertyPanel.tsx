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
  Barcode as BarcodeIcon,
  QrCode as QrCodeIcon,
  Layers,
  ArrowDownUp,
} from 'lucide-react';

export const PropertyPanel: React.FC = () => {
  const {
    report,
    selectedBandId,
    selectedControlId,
    updateControl,
    removeControl,
    updateBandHeight,
    setReport,
  } = useReportStore();

  const selectedBand = report.bands.find((b) => b.id === selectedBandId);
  const selectedControl = selectedBand?.controls.find((c) => c.id === selectedControlId);

  // Update Band properties (e.g. groupBy, pageBreakAfter)
  const updateBandProp = (patch: Record<string, unknown>) => {
    if (!selectedBand) return;
    const updatedBands = report.bands.map((b) =>
      b.id === selectedBand.id ? { ...b, ...patch } : b
    );
    setReport({ ...report, bands: updatedBands });
  };

  if (!selectedBand && !selectedControl) {
    return (
      <aside className="w-72 border-l border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-center items-center text-center text-slate-400 select-none dark:border-slate-800 dark:bg-slate-950/40">
        <SlidersHorizontal className="h-8 w-8 mb-2 stroke-[1.5] text-slate-300 dark:text-slate-700" />
        <p className="text-xs font-medium text-slate-500">未選取任何物件</p>
        <p className="text-[11px] text-slate-400 mt-1">
          點選畫布上的控制項或帶狀區塊以進行屬性設定
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-l border-slate-200 bg-slate-50/50 flex flex-col h-[calc(100vh-3.25rem)] select-none dark:border-slate-800 dark:bg-slate-950/40 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider dark:text-slate-300">
            屬性檢查器 (Properties)
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
        {/* Selected Object Tag */}
        <div className="bg-white p-2.5 rounded-md border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">物件類型</div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            {selectedControl?.type === 'Barcode' && <BarcodeIcon className="h-3.5 w-3.5 text-blue-500" />}
            {selectedControl?.type === 'QRCode' && <QrCodeIcon className="h-3.5 w-3.5 text-purple-500" />}
            <span>{selectedControl ? `${selectedControl.type} 控制項` : `${selectedBand?.type} 區塊`}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono truncate">
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
                  <Label className="text-[10px] text-slate-500">X (水平偏移)</Label>
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
                  <Label className="text-[10px] text-slate-500">Y (垂直偏移)</Label>
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
                  <Label className="text-[10px] text-slate-500">寬度 (Width)</Label>
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
                  <Label className="text-[10px] text-slate-500">高度 (Height)</Label>
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

            {/* 2. Data & Content */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                資料與內容設定
              </span>

              {selectedControl.type === 'Label' && (
                <div>
                  <Label className="text-[10px] text-slate-500">顯示文字 (Text)</Label>
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

              {selectedControl.type === 'Field' && (
                <div>
                  <Label className="text-[10px] text-slate-500">繫結欄位名稱 (Field Name)</Label>
                  <Input
                    value={selectedControl.fieldName ?? ''}
                    placeholder="如 sku, productName, amount"
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        fieldName: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {selectedControl.type === 'Expression' && (
                <div>
                  <Label className="text-[10px] text-slate-500">運算式 (Expression)</Label>
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

              {/* Barcode Specific Inspector */}
              {selectedControl.type === 'Barcode' && (
                <div className="space-y-2 bg-blue-50/50 p-2 rounded border border-blue-200/80 dark:bg-blue-950/30 dark:border-blue-900">
                  <div>
                    <Label className="text-[10px] text-slate-500">條碼碼別 (Format)</Label>
                    <select
                      value={selectedControl.barcodeFormat || 'CODE128'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          barcodeFormat: e.target.value as 'CODE128' | 'EAN13' | 'UPC' | 'CODE39',
                        })
                      }
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="CODE128">Code 128 (標準英數物流碼)</option>
                      <option value="EAN13">EAN-13 (標準商品條碼)</option>
                      <option value="UPC">UPC-A (美規商品碼)</option>
                      <option value="CODE39">Code 39 (工業條碼)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">靜態條碼內容 (預設)</Label>
                    <Input
                      value={selectedControl.text ?? ''}
                      placeholder="如 DO-20261020-0089"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          text: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-slate-500">或動態綁定欄位 (可選)</Label>
                    <Input
                      value={selectedControl.fieldName ?? ''}
                      placeholder="如 sku, orderNo"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          fieldName: e.target.value,
                        })
                      }
                    />
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

              {/* QRCode Specific Inspector */}
              {selectedControl.type === 'QRCode' && (
                <div className="space-y-2 bg-purple-50/50 p-2 rounded border border-purple-200/80 dark:bg-purple-950/30 dark:border-purple-900">
                  <div>
                    <Label className="text-[10px] text-slate-500">容錯率等級 (Error Level)</Label>
                    <select
                      value={selectedControl.qrErrorLevel || 'M'}
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          qrErrorLevel: e.target.value as 'L' | 'M' | 'Q' | 'H',
                        })
                      }
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white dark:bg-slate-850"
                    >
                      <option value="L">L (7% 低容錯，最簡潔)</option>
                      <option value="M">M (15% 中等容錯，推薦)</option>
                      <option value="Q">Q (25% 高容錯)</option>
                      <option value="H">H (30% 極高容錯)</option>
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

                  <div>
                    <Label className="text-[10px] text-slate-500">或動態綁定欄位 (可選)</Label>
                    <Input
                      value={selectedControl.fieldName ?? ''}
                      placeholder="如 trackingUrl, sku"
                      onChange={(e) =>
                        updateControl(selectedBand.id, selectedControl.id, {
                          fieldName: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Format String for text controls */}
              {['Field', 'Expression'].includes(selectedControl.type) && (
                <div>
                  <Label className="text-[10px] text-slate-500">格式化字串 (Format String)</Label>
                  <Input
                    value={selectedControl.formatString ?? ''}
                    placeholder="如 C0 (貨幣), N0 (千分位), date"
                    onChange={(e) =>
                      updateControl(selectedBand.id, selectedControl.id, {
                        formatString: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {/* 3. Typography & Styling */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                外觀與排版樣式
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
                <span className="text-[11px] text-slate-600 dark:text-slate-400">文字粗體 (Bold)</span>
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

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
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

                <div>
                  <Label className="text-[10px] text-slate-500">背景色彩</Label>
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
                      className="text-[11px] font-mono h-7"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Band Specific Properties */}
        {!selectedControl && selectedBand && (
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-slate-500">區塊高度 (Height in pt)</Label>
              <Input
                type="number"
                value={selectedBand.height}
                onChange={(e) =>
                  updateBandHeight(selectedBand.id, Number(e.target.value) || 20)
                }
              />
            </div>

            {/* Grouping Settings for GroupHeader / GroupFooter */}
            {['GroupHeader', 'GroupFooter'].includes(selectedBand.type) && (
              <div className="p-2.5 rounded-md bg-slate-100/80 border border-slate-200 space-y-2 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                  <span>分組小計與換頁設定 (Grouping)</span>
                </div>

                <div>
                  <Label className="text-[10px] text-slate-600">分組依據欄位 (Group By Field)</Label>
                  <Input
                    value={selectedBand.groupBy ?? ''}
                    placeholder="如 category 或 customerName"
                    onChange={(e) => updateBandProp({ groupBy: e.target.value })}
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">
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
                    <option value="asc">升冪排序 (Ascending A-Z / 1-9)</option>
                    <option value="desc">降冪排序 (Descending Z-A / 9-1)</option>
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
                      <ArrowDownUp className="h-3 w-3 text-cyan-700" />
                      <span>每組結束後獨立分頁 (Page Break)</span>
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-cyan-200/80">
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
                跨頁不中斷 (Keep Together)
              </div>
              <p className="text-[10px] text-slate-400">
                {selectedBand.keepTogether
                  ? '已啟用：避免該 Band 在跨頁邊界被截斷'
                  : '未啟用：允許 Band 內部內容自然跨頁'}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
