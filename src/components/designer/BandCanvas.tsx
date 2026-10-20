import React, { useState } from 'react';
import { useReportStore } from '@/store/useReportStore';
import type { ControlDefinition } from '@/types/report';
import { ShieldCheck, Layers, ArrowDownUp } from 'lucide-react';
import { controlRegistry } from '@/controls/registry';
import { mapDesignerControlStyle } from '@/controls/styleUtils';

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

  // Clean, professional band styles that preserve white paper contrast
  const bandMeta: Record<
    string,
    { nameTw: string; dotColor: string; stripBg: string; textColor: string; border: string }
  > = {
    ReportHeader: {
      nameTw: '報表主抬頭/首頁封面',
      dotColor: 'bg-slate-700',
      stripBg: 'bg-slate-100 hover:bg-slate-200/90 text-slate-800',
      textColor: 'text-slate-800',
      border: 'border-slate-300',
    },
    PageHeader: {
      nameTw: '每頁頁首表頭 (重複)',
      dotColor: 'bg-blue-600',
      stripBg: 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-900',
      textColor: 'text-blue-900',
      border: 'border-blue-300',
    },
    GroupHeader: {
      nameTw: '群組開頭/類別標題',
      dotColor: 'bg-cyan-600',
      stripBg: 'bg-cyan-50/90 hover:bg-cyan-100/90 text-cyan-900',
      textColor: 'text-cyan-900',
      border: 'border-cyan-300',
    },
    Detail: {
      nameTw: '資料列逐筆明細 (動態迴圈)',
      dotColor: 'bg-emerald-600',
      stripBg: 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900',
      textColor: 'text-emerald-900',
      border: 'border-emerald-300',
    },
    GroupFooter: {
      nameTw: '群組小計/統計',
      dotColor: 'bg-amber-600',
      stripBg: 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-900',
      textColor: 'text-amber-900',
      border: 'border-amber-300',
    },
    ReportFooter: {
      nameTw: '全表總計/簽核區',
      dotColor: 'bg-purple-600',
      stripBg: 'bg-purple-50/90 hover:bg-purple-100/90 text-purple-900',
      textColor: 'text-purple-900',
      border: 'border-purple-300',
    },
    PageFooter: {
      nameTw: '每頁頁尾/頁碼',
      dotColor: 'bg-orange-600',
      stripBg: 'bg-orange-50/90 hover:bg-orange-100/90 text-orange-900',
      textColor: 'text-orange-900',
      border: 'border-orange-300',
    },
  };

  return (
    <main
      className="flex-1 overflow-auto bg-slate-200/80 p-8 flex justify-center items-start select-none dark:bg-slate-950/80 designer-grid"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => selectControl(null, null)}
    >
      <div
        className="transition-transform duration-75 origin-top"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* Paper Container: ALWAYS pure white paper with realistic sheet shadow */}
        <div
          className="bg-white shadow-2xl border border-slate-300/80 rounded-xs overflow-hidden text-slate-900 relative"
          style={{
            width: `${pageWidth}pt`,
            minHeight: '842pt',
            paddingTop: `${pageSettings.margins.top}pt`,
            paddingBottom: `${pageSettings.margins.bottom}pt`,
            paddingLeft: `${pageSettings.margins.left}pt`,
            paddingRight: `${pageSettings.margins.right}pt`,
          }}
        >
          {/* Visual Margin Guides (Red Dashed Line) */}
          <div
            className="absolute inset-0 pointer-events-none border border-dashed border-red-300/60"
            style={{
              top: `${pageSettings.margins.top}pt`,
              bottom: `${pageSettings.margins.bottom}pt`,
              left: `${pageSettings.margins.left}pt`,
              right: `${pageSettings.margins.right}pt`,
            }}
          />

          {/* Bands Render */}
          <div className="flex flex-col space-y-3 relative z-10">
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
                  className={`flex flex-col rounded-xs border transition-shadow ${
                    isBandSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                      : meta.border
                  }`}
                  style={{ width: `${contentWidth}pt` }}
                >
                  {/* 1. Band Strip Header */}
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
                      <span className="text-[10px] text-slate-600 font-medium">
                        • {meta.nameTw}
                      </span>
                      {band.groupBy && (
                        <span className="flex items-center space-x-1 text-[9px] bg-cyan-100 text-cyan-900 border border-cyan-300 px-1.5 py-0.2 rounded font-mono">
                          <Layers className="h-2.5 w-2.5 text-cyan-700" />
                          <span>分組欄位: {band.groupBy}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-slate-600 font-mono">
                      {band.pageBreakAfter && (
                        <span className="flex items-center space-x-0.5 text-[9px] bg-amber-50 text-amber-800 border border-amber-300 px-1 py-0.2 rounded">
                          <ArrowDownUp className="h-2.5 w-2.5 text-amber-700" />
                          <span>組後換頁</span>
                        </span>
                      )}
                      {band.keepTogether && (
                        <span className="flex items-center space-x-0.5 text-[9px] bg-white border border-slate-300 px-1 py-0.2 rounded text-emerald-800">
                          <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                          <span>不跨頁</span>
                        </span>
                      )}
                      <span className="bg-white px-1.5 py-0.2 rounded border border-slate-300 text-slate-700">
                        {band.height} pt
                      </span>
                    </div>
                  </div>

                  {/* 2. Band Content Workspace: ALWAYS pure white paper background */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectControl(band.id, null);
                    }}
                    className="relative bg-white"
                    style={{
                      height: `${band.height}pt`,
                      width: '100%',
                    }}
                  >
                    {/* Render Controls inside Band using standardized registry */}
                    {band.controls.map((control) => {
                      const isControlSelected = selectedControlId === control.id;
                      const plugin = controlRegistry.get(control.type);
                      const baseStyle = mapDesignerControlStyle(control);

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
                              : 'hover:ring-1 hover:ring-slate-400/80 z-10'
                          }`}
                          style={baseStyle}
                        >
                          {plugin ? (
                            <plugin.DesignerComponent control={control} isSelected={isControlSelected} />
                          ) : (
                            <span className="truncate">{control.text}</span>
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
                      <div className="h-1 w-16 bg-slate-400 rounded-full group-hover:bg-blue-600 transition-colors shadow-xs" />
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
