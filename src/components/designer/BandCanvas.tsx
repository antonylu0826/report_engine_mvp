import React, { useState, useEffect } from 'react';
import { useReportStore } from '@/store/useReportStore';
import type { ControlDefinition, BandDefinition, ControlType } from '@/types/report';
import {
  Layers,
  Plus,
  Trash2,
  TableProperties,
  FolderTree,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { controlRegistry } from '@/controls/registry';
import { mapDesignerControlStyle } from '@/controls/styleUtils';

export type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizingControlState {
  bandId: string;
  controlId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
}

export const BandCanvas: React.FC = () => {
  const {
    report,
    data,
    selectedBandId,
    selectedControlId,
    selectControl,
    updateControl,
    addControl,
    removeControl,
    updateBandHeight,
    setReport,
    zoom,
    setZoom,
    editingSubReportPath,
    exitSubReportEditor,
    getActiveReport,
  } = useReportStore();

  const activeReport = getActiveReport();
  const { pageSettings, bands } = activeReport;

  // Track hover state when dragging a control from palette over a band
  const [dragOverBandId, setDragOverBandId] = useState<string | null>(null);

  // Track dragging of controls
  const [draggingControl, setDraggingControl] = useState<{
    bandId: string;
    controlId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Track resizing of controls
  const [resizingControl, setResizingControl] = useState<ResizingControlState | null>(null);

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

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    bandId: string,
    control: ControlDefinition,
    direction: ResizeDirection
  ) => {
    e.stopPropagation();
    e.preventDefault();
    selectControl(bandId, control.id);

    setResizingControl({
      bandId,
      controlId: control.id,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      initialX: control.x,
      initialY: control.y,
      initialWidth: control.width,
      initialHeight: control.height,
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

  // Window-level mouse move & up listeners to prevent jerky dragging or losing focus
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Control Resizing via 8-way drag handles
      if (resizingControl) {
        const dx = (e.clientX - resizingControl.startX) / zoom;
        const dy = (e.clientY - resizingControl.startY) / zoom;

        let newX = resizingControl.initialX;
        let newY = resizingControl.initialY;
        let newWidth = resizingControl.initialWidth;
        let newHeight = resizingControl.initialHeight;

        const dir = resizingControl.direction;

        // Horizontal size & position
        if (dir.includes('e')) {
          newWidth = Math.max(10, Math.round(resizingControl.initialWidth + dx));
        }
        if (dir.includes('w')) {
          const potentialWidth = Math.round(resizingControl.initialWidth - dx);
          if (potentialWidth >= 10) {
            newWidth = potentialWidth;
            newX = Math.round(resizingControl.initialX + dx);
          }
        }

        // Vertical size & position
        if (dir.includes('s')) {
          newHeight = Math.max(4, Math.round(resizingControl.initialHeight + dy));
        }
        if (dir.includes('n')) {
          const potentialHeight = Math.round(resizingControl.initialHeight - dy);
          if (potentialHeight >= 4) {
            newHeight = potentialHeight;
            newY = Math.round(resizingControl.initialY + dy);
          }
        }

        updateControl(resizingControl.bandId, resizingControl.controlId, {
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: newWidth,
          height: newHeight,
        });
        return;
      }

      // 2. Control Move Dragging
      if (draggingControl) {
        const dx = (e.clientX - draggingControl.startX) / zoom;
        const dy = (e.clientY - draggingControl.startY) / zoom;
        const nextX = Math.max(0, Math.round(draggingControl.initialX + dx));
        const nextY = Math.max(0, Math.round(draggingControl.initialY + dy));

        updateControl(draggingControl.bandId, draggingControl.controlId, {
          x: nextX,
          y: nextY,
        });
        return;
      }

      // 3. Band Height Resizing
      if (resizingBand) {
        const dy = (e.clientY - resizingBand.startY) / zoom;
        const nextHeight = Math.max(16, Math.round(resizingBand.initialHeight + dy));
        updateBandHeight(resizingBand.bandId, nextHeight);
      }
    };

    const handleGlobalMouseUp = () => {
      setDraggingControl(null);
      setResizingBand(null);
      setResizingControl(null);
    };

    if (draggingControl || resizingBand || resizingControl) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingControl, resizingBand, resizingControl, zoom, updateControl, updateBandHeight]);

  // Global Keyboard Shortcuts (Delete, Escape, Arrow keys nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or select
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (isInputFocused) return;

      // 1. Delete or Backspace: Remove selected control
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBandId && selectedControlId) {
        e.preventDefault();
        removeControl(selectedBandId, selectedControlId);
        selectControl(selectedBandId, null);
        return;
      }

      // 2. Escape: Deselect all
      if (e.key === 'Escape') {
        selectControl(null, null);
        return;
      }

      // 3. Arrow keys: Precision Nudge for selected control (1pt, or 5pt if Shift is pressed)
      if (
        selectedBandId &&
        selectedControlId &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        const band = report.bands.find((b) => b.id === selectedBandId);
        const control = band?.controls.find((c) => c.id === selectedControlId);
        if (!control) return;

        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        let newX = control.x;
        let newY = control.y;

        if (e.key === 'ArrowLeft') newX = Math.max(0, control.x - step);
        if (e.key === 'ArrowRight') newX = control.x + step;
        if (e.key === 'ArrowUp') newY = Math.max(0, control.y - step);
        if (e.key === 'ArrowDown') newY = control.y + step;

        updateControl(selectedBandId, selectedControlId, {
          x: newX,
          y: newY,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBandId, selectedControlId, report, removeControl, selectControl, updateControl]);

  // Ctrl + Wheel to zoom canvas smoothly
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const nextZoom = Math.min(2.0, Math.max(0.5, Math.round((zoom + delta) * 100) / 100));
      setZoom(nextZoom);
    }
  };

  // Drag & drop handlers for dragging controls from Toolbox palette or Field Explorer onto a Band
  const handleBandDragOver = (e: React.DragEvent, bandId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverBandId !== bandId) {
      setDragOverBandId(bandId);
    }
  };

  const handleBandDragLeave = (e: React.DragEvent, bandId: string) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverBandId === bandId) {
      setDragOverBandId(null);
    }
  };

  const handleBandDrop = (e: React.DragEvent, bandId: string) => {
    e.preventDefault();
    setDragOverBandId(null);

    const controlType = e.dataTransfer.getData('report-control-type') as ControlType;
    const fieldName = e.dataTransfer.getData('report-field-name');

    if (!controlType) return;

    const plugin = controlRegistry.get(controlType);
    if (!plugin) return;

    const defaults = plugin.createDefault();

    // Calculate mouse position relative to Band workspace in points (pt)
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;

    const width = defaults.width ?? plugin.defaultWidth;
    const height = defaults.height ?? plugin.defaultHeight;

    const dropX = Math.max(0, Math.round(rawX - 5));
    const dropY = Math.max(0, Math.round(rawY - 5));

    addControl(bandId, {
      type: controlType,
      x: dropX,
      y: dropY,
      width,
      height,
      fieldName: fieldName || defaults.fieldName,
      text: fieldName ? `[${fieldName}]` : defaults.text,
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

    selectControl(bandId, null);
  };

  // Printable page width in pt
  const pageWidth = pageSettings.size === 'A4' ? 595.28 : 612;
  const contentWidth = pageWidth - pageSettings.margins.left - pageSettings.margins.right;

  // Available dataset fields for grouping selector
  const sampleFields = data && data.length > 0 ? Object.keys(data[0]) : ['category', 'sku'];

  // Check if current report has grouping bands
  const hasGrouping = bands.some((b) => b.type === 'GroupHeader' || b.type === 'GroupFooter');

  // Contextual Action: Add GroupHeader and GroupFooter wrapping Detail
  const handleAddGrouping = (defaultField = 'category') => {
    const detailIndex = bands.findIndex((b) => b.type === 'Detail');
    if (detailIndex === -1) return;

    const groupHeader: BandDefinition = {
      id: `band-group-header-${Date.now().toString().slice(-4)}`,
      type: 'GroupHeader',
      height: 20,
      groupBy: defaultField,
      groupSortOrder: 'asc',
      controls: [
        {
          id: `ctl-gh-title-${Date.now().toString().slice(-4)}`,
          type: 'Label',
          x: 6,
          y: 3,
          width: 65,
          height: 14,
          text: '【 類別 】',
          style: {
            fontSize: 8.5,
            fontWeight: 'bold',
            color: '#0f172a',
          },
        },
        {
          id: `ctl-gh-category-${Date.now().toString().slice(-4)}`,
          type: 'Field',
          fieldName: defaultField,
          x: 72,
          y: 3,
          width: 150,
          height: 14,
          style: {
            fontSize: 9,
            fontWeight: 'bold',
            color: '#0f172a',
          },
        },
      ],
    };

    const groupFooter: BandDefinition = {
      id: `band-group-footer-${Date.now().toString().slice(-4)}`,
      type: 'GroupFooter',
      height: 18,
      groupBy: defaultField,
      groupSortOrder: 'asc',
      controls: [
        {
          id: `ctl-gf-line-${Date.now().toString().slice(-4)}`,
          type: 'Line',
          x: 0,
          y: 0,
          width: contentWidth,
          height: 0.5,
          style: { color: '#e2e8f0' },
        },
        {
          id: `ctl-gf-label-${Date.now().toString().slice(-4)}`,
          type: 'Label',
          x: contentWidth - 175,
          y: 3,
          width: 80,
          height: 12,
          text: '本類別小計：',
          style: {
            fontSize: 8,
            color: '#64748b',
            textAlign: 'right',
          },
        },
        {
          id: `ctl-gf-sum-${Date.now().toString().slice(-4)}`,
          type: 'Expression',
          expression: '=SUM(amount)',
          formatString: 'C0',
          x: contentWidth - 95,
          y: 3,
          width: 95,
          height: 12,
          style: {
            fontSize: 8.5,
            fontWeight: 'bold',
            color: '#0f172a',
            textAlign: 'right',
          },
        },
      ],
    };

    const newBands = [...bands];
    // Insert GroupFooter after Detail first
    newBands.splice(detailIndex + 1, 0, groupFooter);
    // Insert GroupHeader before Detail
    newBands.splice(detailIndex, 0, groupHeader);

    setReport({ ...report, bands: newBands });
    selectControl(groupHeader.id, null);
  };

  // Contextual Action: Remove both GroupHeader and GroupFooter
  const handleRemoveGrouping = () => {
    const updated = bands.filter(
      (b) => b.type !== 'GroupHeader' && b.type !== 'GroupFooter'
    );
    setReport({ ...report, bands: updated });
    selectControl(null, null);
  };

  // Contextual Action: Change groupBy field for all grouping bands
  const handleChangeGroupBy = (newField: string) => {
    const updated = bands.map((b) => {
      if (b.type === 'GroupHeader' || b.type === 'GroupFooter') {
        const nextControls = b.controls.map((c) => {
          if (c.type === 'Field' && c.fieldName) {
            return { ...c, fieldName: newField };
          }
          return c;
        });
        return { ...b, groupBy: newField, controls: nextControls };
      }
      return b;
    });
    setReport({ ...report, bands: updated });
  };

  // Band visual appearance metadata: unified clean professional style across all bands
  const defaultMeta = {
    dotColor: 'bg-slate-500',
    stripBg: 'bg-slate-100 hover:bg-slate-200/90 text-slate-800',
    textColor: 'text-slate-800',
    border: 'border-slate-300',
  };

  const bandMeta: Record<
    string,
    { nameTw: string; dotColor: string; stripBg: string; textColor: string; border: string }
  > = {
    ReportHeader: { ...defaultMeta, nameTw: '報表表頭' },
    PageHeader: { ...defaultMeta, nameTw: '頁首' },
    GroupHeader: { ...defaultMeta, nameTw: '群組首' },
    Detail: { ...defaultMeta, nameTw: '明細區' },
    GroupFooter: { ...defaultMeta, nameTw: '群組尾' },
    ReportFooter: { ...defaultMeta, nameTw: '報表表尾' },
    PageFooter: { ...defaultMeta, nameTw: '頁尾' },
  };

  return (
    <main
      className="flex-1 overflow-auto bg-slate-200/80 p-8 flex justify-center items-start select-none dark:bg-slate-950/80 designer-grid"
      onClick={() => selectControl(null, null)}
      onWheel={handleWheel}
    >
      <div
        className="transition-transform duration-75 origin-top"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* SubReport Secondary Canvas Breadcrumb Banner */}
        {editingSubReportPath && (
          <div className="mb-3 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-2 text-xs">
              <Badge variant="secondary" className="gap-1 font-normal text-slate-700 dark:text-slate-200">
                <TableProperties className="w-3 h-3 text-slate-500" />
                <span>子報表</span>
              </Badge>
              <button
                onClick={exitSubReportEditor}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                {report.name}
              </button>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {activeReport.name}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={exitSubReportEditor}
              className="h-7 text-xs px-2.5 font-normal text-slate-700 dark:text-slate-200"
            >
              返回主報表
            </Button>
          </div>
        )}

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
                  {/* 1. Band Strip Header with Contextual Actions */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectControl(band.id, null);
                    }}
                    className={`h-6 px-2.5 flex items-center justify-between border-b cursor-pointer transition-colors ${meta.stripBg} ${meta.border}`}
                  >
                    {/* Left: Band Name, Dot and Contextual Indicators */}
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                      <span className={`text-[11px] font-bold tracking-wide ${meta.textColor}`}>
                        {meta.nameTw}
                      </span>

                      {/* Grouping Field Selector (Directly on GroupHeader / GroupFooter) */}
                      {(band.type === 'GroupHeader' || band.type === 'GroupFooter') && (
                        <div
                          className="flex items-center space-x-1 text-[9px] bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-2xs text-slate-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Layers className="h-2.5 w-2.5 text-slate-500" />
                          <span>分組依據:</span>
                          <select
                            value={band.groupBy || 'category'}
                            onChange={(e) => handleChangeGroupBy(e.target.value)}
                            className="bg-transparent font-semibold font-mono text-[10px] text-slate-800 focus:outline-none cursor-pointer"
                          >
                            {sampleFields.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2 text-[10px] text-slate-600 font-mono">
                      {/* Contextual Action: Add Grouping from Detail Band */}
                      {band.type === 'Detail' && !hasGrouping && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddGrouping();
                          }}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-white hover:bg-slate-900 shadow-2xs transition-colors"
                          title="在資料列上下加入群組表頭與群組小計"
                        >
                          <Plus className="h-3 w-3" />
                          <span>新增分組小計</span>
                        </button>
                      )}

                      {/* Detail indicator if grouping is active */}
                      {band.type === 'Detail' && hasGrouping && (
                        <span className="flex items-center space-x-1 text-[9px] text-slate-700 bg-slate-200/70 border border-slate-300 px-1.5 py-0.2 rounded font-sans">
                          <FolderTree className="h-2.5 w-2.5 text-slate-500" />
                          <span>群組明細列</span>
                        </span>
                      )}

                      {/* Contextual Action: Remove Grouping from GroupHeader or GroupFooter */}
                      {(band.type === 'GroupHeader' || band.type === 'GroupFooter') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('確定要移除此分組結構 (包含群組表頭與小計) 嗎？')) {
                              handleRemoveGrouping();
                            }
                          }}
                          className="inline-flex items-center space-x-0.5 text-[9px] text-slate-500 hover:text-red-600 hover:bg-slate-200/80 px-1.5 py-0.5 rounded transition-colors border border-transparent hover:border-slate-300"
                          title="移除群組結構"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          <span>移除分組</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Band Content Workspace: ALWAYS pure white paper background */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectControl(band.id, null);
                    }}
                    onDragOver={(e) => handleBandDragOver(e, band.id)}
                    onDragLeave={(e) => handleBandDragLeave(e, band.id)}
                    onDrop={(e) => handleBandDrop(e, band.id)}
                    className={`relative bg-white transition-all ${
                      dragOverBandId === band.id
                        ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20'
                        : ''
                    }`}
                    style={{
                      height: `${band.height}pt`,
                      width: '100%',
                    }}
                  >
                    {/* Visual Drop Guide Indicator when hovering with dragged control */}
                    {dragOverBandId === band.id && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-2 border-dashed border-blue-500/80 bg-blue-50/20 z-30">
                        <span className="text-[11px] font-semibold text-blue-700 bg-white/95 px-2.5 py-1 rounded-md shadow-xs border border-blue-200 font-mono">
                          釋放滑鼠以放置控制項於此處
                        </span>
                      </div>
                    )}
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

                          {/* Interactive Resize Handles (Permanently visible when control is selected) */}
                          {isControlSelected && (() => {
                            const isLine = control.type === 'Line';
                            const isVerticalLine = isLine && control.lineOrientation === 'vertical';
                            const isHorizontalLine = isLine && !isVerticalLine;
                            const handleStyle = "w-2.5 h-2.5 bg-blue-600 border-2 border-white rounded-[1.5px] shadow-md z-30 transition-transform hover:scale-125";

                            // 1. Horizontal Line: Only Left & Right length handles
                            if (isHorizontalLine) {
                              return (
                                <>
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 'w')}
                                    className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 ${handleStyle} cursor-ew-resize`}
                                    title="拖曳調整線條長度 (左端)"
                                  />
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 'e')}
                                    className={`absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 ${handleStyle} cursor-ew-resize`}
                                    title="拖曳調整線條長度 (右端)"
                                  />
                                  {resizingControl?.controlId === control.id && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-40 whitespace-nowrap">
                                      寬度: {control.width} pt
                                    </div>
                                  )}
                                </>
                              );
                            }

                            // 2. Vertical Line: Only Top & Bottom length handles
                            if (isVerticalLine) {
                              return (
                                <>
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 'n')}
                                    className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 ${handleStyle} cursor-ns-resize`}
                                    title="拖曳調整線條長度 (頂端)"
                                  />
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 's')}
                                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 ${handleStyle} cursor-ns-resize`}
                                    title="拖曳調整線條長度 (底端)"
                                  />
                                  {resizingControl?.controlId === control.id && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-40 whitespace-nowrap">
                                      高度: {control.height} pt
                                    </div>
                                  )}
                                </>
                              );
                            }

                            // 3. All standard controls (Label, Field, Expression, Image, Panel, Barcode, QRCode): Full 8-direction handles
                            const handles: { dir: ResizeDirection; pos: string; cursor: string }[] = [
                              { dir: 'nw', pos: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nwse-resize' },
                              { dir: 'n',  pos: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ns-resize' },
                              { dir: 'ne', pos: 'top-0 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-nesw-resize' },
                              { dir: 'e',  pos: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
                              { dir: 'se', pos: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2', cursor: 'cursor-nwse-resize' },
                              { dir: 's',  pos: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-ns-resize' },
                              { dir: 'sw', pos: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2', cursor: 'cursor-nesw-resize' },
                              { dir: 'w',  pos: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
                            ];

                            return (
                              <>
                                {handles.map(({ dir, pos, cursor }) => (
                                  <div
                                    key={dir}
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, dir)}
                                    className={`absolute ${pos} ${handleStyle} ${cursor}`}
                                  />
                                ))}

                                {/* Live dimension badge during resizing */}
                                {resizingControl?.controlId === control.id && (
                                  <div className="absolute -top-5 left-0 bg-slate-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-40 whitespace-nowrap">
                                    {control.width} × {control.height} pt
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })}

                    {/* Band Height Resize Handle (Bottom Edge) - Permanently visible when band is selected */}
                    <div
                      onMouseDown={(e) => handleBandResizeMouseDown(e, band.id, band.height)}
                      className={`absolute -bottom-1.5 left-0 right-0 h-3 cursor-row-resize flex items-center justify-center z-20 group transition-opacity ${
                        isBandSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                      }`}
                      title="拖曳以調整 Band 高度"
                    >
                      <div className={`h-1.5 w-20 rounded-full transition-colors shadow-xs ${
                        isBandSelected ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-slate-400 group-hover:bg-blue-600'
                      }`} />
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
