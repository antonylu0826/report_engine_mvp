import React, { useState } from 'react';
import { useReportStore } from '@/store/useReportStore';
import type { ControlDefinition } from '@/types/report';
import { ShieldCheck } from 'lucide-react';

export const BandCanvas: React.FC = () => {
  const {
    report,
    selectedBandId,
    selectedControlId,
    selectControl,
    updateControl,
    updateBandHeight,
    zoom,
  } = useReportStore();

  const { pageSettings, bands } = report;

  // Track dragging of controls
  const [draggingControl, setDraggingControl] = useState<{
    bandId: string;
    controlId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Track resizing of bands
  const [resizingBand, setResizingBand] = useState<{
    bandId: string;
    startY: number;
    initialHeight: number;
  } | null>(null);

  const handleControlMouseDown = (
    e: React.MouseEvent,
    bandId: string,
    control: ControlDefinition
  ) => {
    e.stopPropagation();
    selectControl(bandId, control.id);

    setDraggingControl({
      bandId,
      controlId: control.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: control.x,
      initialY: control.y,
    });
  };

  const handleBandResizeMouseDown = (
    e: React.MouseEvent,
    bandId: string,
    currentHeight: number
  ) => {
    e.stopPropagation();
    setResizingBand({
      bandId,
      startY: e.clientY,
      initialHeight: currentHeight,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Handle control dragging
    if (draggingControl) {
      const dx = (e.clientX - draggingControl.startX) / zoom;
      const dy = (e.clientY - draggingControl.startY) / zoom;
      const nextX = Math.max(0, Math.round(draggingControl.initialX + dx));
      const nextY = Math.max(0, Math.round(draggingControl.initialY + dy));

      updateControl(draggingControl.bandId, draggingControl.controlId, {
        x: nextX,
        y: nextY,
      });
    }

    // 2. Handle band height resizing
    if (resizingBand) {
      const dy = (e.clientY - resizingBand.startY) / zoom;
      const nextHeight = Math.max(16, Math.round(resizingBand.initialHeight + dy));
      updateBandHeight(resizingBand.bandId, nextHeight);
    }
  };

  const handleMouseUp = () => {
    setDraggingControl(null);
    setResizingBand(null);
  };

  // Printable page width in pt
  const pageWidth = pageSettings.size === 'A4' ? 595.28 : 612;
  const contentWidth = pageWidth - pageSettings.margins.left - pageSettings.margins.right;

  const bandMeta: Record<
    string,
    { nameTw: string; dotColor: string; stripBg: string; textColor: string; border: string }
  > = {
    ReportHeader: {
      nameTw: '報表首頁/封面',
      dotColor: 'bg-slate-600',
      stripBg: 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80',
      textColor: 'text-slate-800 dark:text-slate-100',
      border: 'border-slate-300 dark:border-slate-700',
    },
    PageHeader: {
      nameTw: '每頁頁首表頭',
      dotColor: 'bg-blue-600',
      stripBg: 'bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50',
      textColor: 'text-blue-900 dark:text-blue-200',
      border: 'border-blue-200 dark:border-blue-800',
    },
    GroupHeader: {
      nameTw: '群組開頭',
      dotColor: 'bg-cyan-600',
      stripBg: 'bg-cyan-50/80 hover:bg-cyan-100/80 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50',
      textColor: 'text-cyan-900 dark:text-cyan-200',
      border: 'border-cyan-200 dark:border-cyan-800',
    },
    Detail: {
      nameTw: '資料列逐筆明細',
      dotColor: 'bg-emerald-600',
      stripBg: 'bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50',
      textColor: 'text-emerald-900 dark:text-emerald-200',
      border: 'border-emerald-300 dark:border-emerald-800',
    },
    GroupFooter: {
      nameTw: '群組小計/統計',
      dotColor: 'bg-amber-600',
      stripBg: 'bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50',
      textColor: 'text-amber-900 dark:text-amber-200',
      border: 'border-amber-200 dark:border-amber-800',
    },
    ReportFooter: {
      nameTw: '全表總計/簽核',
      dotColor: 'bg-purple-600',
      stripBg: 'bg-purple-50/80 hover:bg-purple-100/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/50',
      textColor: 'text-purple-900 dark:text-purple-200',
      border: 'border-purple-200 dark:border-purple-800',
    },
    PageFooter: {
      nameTw: '每頁頁尾/頁碼',
      dotColor: 'bg-orange-600',
      stripBg: 'bg-orange-50/80 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:hover:bg-orange-900/50',
      textColor: 'text-orange-900 dark:text-orange-200',
      border: 'border-orange-200 dark:border-orange-800',
    },
  };

  return (
    <main
      className="flex-1 overflow-auto bg-slate-100/70 p-8 flex justify-center items-start select-none dark:bg-slate-900/60"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => selectControl(null, null)}
    >
      <div
        className="transition-transform duration-75 origin-top"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* Paper Container */}
        <div
          className="bg-white shadow-xl border border-slate-200 rounded-sm overflow-hidden text-slate-900 relative dark:bg-slate-950 dark:border-slate-800"
          style={{
            width: `${pageWidth}pt`,
            minHeight: '842pt',
            paddingTop: `${pageSettings.margins.top}pt`,
            paddingBottom: `${pageSettings.margins.bottom}pt`,
            paddingLeft: `${pageSettings.margins.left}pt`,
            paddingRight: `${pageSettings.margins.right}pt`,
          }}
        >
          {/* Visual Margin Guides */}
          <div
            className="absolute inset-0 pointer-events-none border border-dashed border-red-200/50"
            style={{
              top: `${pageSettings.margins.top}pt`,
              bottom: `${pageSettings.margins.bottom}pt`,
              left: `${pageSettings.margins.left}pt`,
              right: `${pageSettings.margins.right}pt`,
            }}
          />

          {/* Bands Render */}
          <div className="flex flex-col space-y-3">
            {bands.map((band) => {
              const isBandSelected = selectedBandId === band.id;
              const meta = bandMeta[band.type] || {
                nameTw: band.type,
                dotColor: 'bg-slate-500',
                stripBg: 'bg-slate-100',
                textColor: 'text-slate-800',
                border: 'border-slate-300',
              };

              return (
                <div
                  key={band.id}
                  className={`flex flex-col rounded-sm border transition-shadow ${
                    isBandSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : meta.border
                  }`}
                  style={{ width: `${contentWidth}pt` }}
                >
                  {/* 1. Band Strip Header: 點擊選取該 Band */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectControl(band.id, null);
                    }}
                    className={`h-5.5 px-2.5 flex items-center justify-between border-b cursor-pointer transition-colors ${meta.stripBg} ${meta.border}`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                      <span className={`text-[11px] font-bold tracking-wide ${meta.textColor}`}>
                        {band.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        • {meta.nameTw}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                      {band.keepTogether && (
                        <span className="flex items-center space-x-0.5 text-[9px] bg-white/80 border border-slate-200 px-1 py-0.2 rounded dark:bg-slate-900 dark:border-slate-800">
                          <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                          <span>不跨頁</span>
                        </span>
                      )}
                      <span className="bg-white/80 px-1.5 py-0.2 rounded border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                        {band.height} pt
                      </span>
                    </div>
                  </div>

                  {/* 2. Band Content Workspace: 點擊空白處選取該 Band */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectControl(band.id, null);
                    }}
                    className="relative bg-white dark:bg-slate-950 transition-colors"
                    style={{
                      height: `${band.height}pt`,
                      width: '100%',
                    }}
                  >
                    {/* Render Controls inside Band */}
                    {band.controls.map((control) => {
                      const isControlSelected = selectedControlId === control.id;

                      return (
                        <div
                          key={control.id}
                          onMouseDown={(e) => handleControlMouseDown(e, band.id, control)}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectControl(band.id, control.id);
                          }}
                          className={`absolute cursor-move select-none transition-shadow ${
                            isControlSelected
                              ? 'ring-2 ring-blue-600 ring-offset-1 z-20 shadow-md bg-blue-50/20'
                              : 'hover:ring-1 hover:ring-slate-400/60 z-10'
                          }`}
                          style={{
                            left: `${control.x}pt`,
                            top: `${control.y}pt`,
                            width: `${control.width}pt`,
                            height: `${control.height}pt`,
                            fontSize: `${control.style?.fontSize ?? 9}pt`,
                            fontWeight: control.style?.fontWeight ?? 'normal',
                            color: control.style?.color ?? '#0f172a',
                            backgroundColor: control.style?.backgroundColor ?? 'transparent',
                            textAlign: control.style?.textAlign ?? 'left',
                            borderTopWidth: `${control.style?.borderTopWidth ?? (control.style?.borderWidth ?? 0)}pt`,
                            borderBottomWidth: `${control.style?.borderBottomWidth ?? (control.style?.borderWidth ?? 0)}pt`,
                            borderLeftWidth: `${control.style?.borderLeftWidth ?? (control.style?.borderWidth ?? 0)}pt`,
                            borderRightWidth: `${control.style?.borderRightWidth ?? (control.style?.borderWidth ?? 0)}pt`,
                            borderColor: control.style?.borderColor ?? '#cbd5e1',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent:
                              control.style?.textAlign === 'center'
                                ? 'center'
                                : control.style?.textAlign === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                            padding: '0 2pt',
                          }}
                        >
                          {control.type === 'Line' ? (
                            <div
                              className="w-full"
                              style={{
                                height: `${control.height}pt`,
                                backgroundColor: control.style?.color || '#cbd5e1',
                              }}
                            />
                          ) : control.type === 'Field' ? (
                            <span className="truncate font-mono text-[10px] text-emerald-800 bg-emerald-50/80 px-1 py-0.5 rounded border border-emerald-200/60 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800">
                              [{control.fieldName}]
                            </span>
                          ) : control.type === 'Expression' ? (
                            <span className="truncate font-mono text-[10px] text-purple-800 bg-purple-50/80 px-1 py-0.5 rounded border border-purple-200/60 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-800">
                              {control.expression}
                            </span>
                          ) : (
                            <span
                              className="truncate"
                              style={{
                                width: control.style?.textAlign ? '100%' : undefined,
                                textAlign: control.style?.textAlign ?? 'left',
                              }}
                            >
                              {control.text}
                            </span>
                          )}

                          {/* Selected Resize Handles */}
                          {isControlSelected && (
                            <>
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 rounded-full" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full" />
                              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 rounded-full" />
                              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 rounded-full" />
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Band Height Resize Handle (Bottom Edge) */}
                    <div
                      onMouseDown={(e) => handleBandResizeMouseDown(e, band.id, band.height)}
                      className="absolute -bottom-1.5 left-0 right-0 h-3 cursor-row-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20 group"
                      title="拖曳以調整 Band 高度"
                    >
                      <div className="h-1 w-16 bg-slate-400/80 rounded-full group-hover:bg-blue-500 transition-colors shadow-xs" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
};
