import React, { useState, useEffect, useRef } from 'react';
import { createSubReportForFields } from '@/report/defaultSubReport';
import { schemaField } from '@/data/schemaField';
import { useFormulaData } from '../formula/useFormulaData';
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
import { useTranslations, useCurrentLocale } from '@/i18n';
import { getBandName } from '@/constants/labels';
import { CSS_PIXELS_PER_POINT, getPageGeometry, getSubReportGeometry } from '@/report/geometry';

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

const createUniqueId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const BandCanvas: React.FC = () => {
  const {
    report,
    selectedBandId,
    diagnosticNavigationRevision, selectedControlId, selectedControlIds, toggleControl, beginTransaction, endTransaction, updateBand,
    selectControl,
    updateControl,
    addControl,
    updateBandHeight,
    updateActiveReport,
    zoom,
    setZoom,
    editingSubReportPath,
    exitSubReportEditor,
    getActiveReport,
  } = useReportStore();

  const { locale } = useCurrentLocale();
  const tBands = useTranslations('bands');
  const tControls = useTranslations('controls');

  const activeReport = getActiveReport();
  const activeSchema = useFormulaData().schema;
  const { pageSettings, bands } = activeReport;
  const { width: pageWidth, height: pageHeight, printableWidth } = getPageGeometry(pageSettings);
  const parentControl = editingSubReportPath && report.bands.find(b => b.id === editingSubReportPath.bandId)
    ?.controls.find(c => c.id === editingSubReportPath.controlId);
  const contentWidth = parentControl ? getSubReportGeometry(parentControl).width : printableWidth;

  const canvas = useRef<HTMLElement | null>(null);
  useEffect(()=>{
    if(!diagnosticNavigationRevision)return;
    const selector=selectedControlId?`[data-control-id="${CSS.escape(selectedControlId)}"]`:selectedBandId?`[data-band-id="${CSS.escape(selectedBandId)}"]`:undefined;
    if(selector)canvas.current?.querySelector(selector)?.scrollIntoView({block:'center',inline:'nearest'});
  },[diagnosticNavigationRevision,selectedControlId,selectedBandId]);
  const moved = useRef(false);
  const suppressClick = useRef(false);
  const clickReset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    controls: ControlDefinition[];
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
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget.closest('.report-engine-designer') as HTMLElement)?.focus();
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleControl(bandId, control.id); return; }
    const ids = selectedBandId === bandId && selectedControlIds.includes(control.id) ? selectedControlIds : [control.id];
    if (!ids.includes(selectedControlId ?? '')) selectControl(bandId, control.id);
    if (!selectedControlIds.includes(control.id)) selectControl(bandId, control.id);
    moved.current = false;
    beginTransaction();
    setDraggingControl({
      bandId,
      controlId: control.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: control.x,
      initialY: control.y,
      controls: activeReport.bands.find(b => b.id === bandId)!.controls.filter(c => ids.includes(c.id)),
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
    (e.currentTarget.closest('.report-engine-designer') as HTMLElement)?.focus();
    selectControl(bandId, control.id);
    moved.current = false;
    beginTransaction();
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
    moved.current = false;
    beginTransaction();
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
        const dx = (e.clientX - resizingControl.startX) / (zoom * CSS_PIXELS_PER_POINT);
        const dy = (e.clientY - resizingControl.startY) / (zoom * CSS_PIXELS_PER_POINT);
        if (dx || dy) moved.current = true;

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
        const dx = (e.clientX - draggingControl.startX) / (zoom * CSS_PIXELS_PER_POINT);
        const dy = (e.clientY - draggingControl.startY) / (zoom * CSS_PIXELS_PER_POINT);
        if (dx || dy) moved.current = true;
        const originals = draggingControl.controls;
        const printableWidth = contentWidth;
        const band = activeReport.bands.find(b => b.id === draggingControl.bandId)!;
        const offsetX = Math.max(-Math.min(...originals.map(c => c.x)), Math.min(Math.round(dx), Math.max(0, printableWidth - Math.max(...originals.map(c => c.x + c.width)))));
        const offsetY = Math.max(-Math.min(...originals.map(c => c.y)), Math.min(Math.round(dy), Math.max(0, band.height - Math.max(...originals.map(c => c.y + c.height)))));
        updateBand(band.id, { controls: band.controls.map(c => {
          const original = originals.find(item => item.id === c.id);
          return original ? { ...c, x: original.x + offsetX, y: original.y + offsetY } : c;
        }) });
        return;
      }

      // 3. Band Height Resizing
      if (resizingBand) {
        const dy = (e.clientY - resizingBand.startY) / (zoom * CSS_PIXELS_PER_POINT);
        if (dy) moved.current = true;
        const nextHeight = Math.max(16, Math.round(resizingBand.initialHeight + dy));
        updateBandHeight(resizingBand.bandId, nextHeight);
      }
    };

    const handleGlobalMouseUp = () => {
      endTransaction();
      if (moved.current) {
        suppressClick.current = true; moved.current = false;
        clearTimeout(clickReset.current);
        clickReset.current = setTimeout(() => { suppressClick.current = false; }, 0);
      }
      setDraggingControl(null);
      setResizingBand(null);
      setResizingControl(null);
    };

    if (draggingControl || resizingBand || resizingControl) {
      window.addEventListener('mousemove', handleGlobalMouseMove);

    }

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('blur', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('blur', handleGlobalMouseUp);
    };
  }, [draggingControl, resizingBand, resizingControl, zoom, updateControl, updateBandHeight, updateBand, endTransaction, activeReport, contentWidth]);

  useEffect(() => () => { endTransaction(); clearTimeout(clickReset.current); }, [endTransaction]);

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
    const rawX = (e.clientX - rect.left) / (zoom * CSS_PIXELS_PER_POINT);
    const rawY = (e.clientY - rect.top) / (zoom * CSS_PIXELS_PER_POINT);

    const width = Math.min(defaults.width ?? plugin.defaultWidth, contentWidth);
    const height = defaults.height ?? plugin.defaultHeight;

    const dropX = Math.max(0, Math.round(rawX - 5));
    const dropY = Math.max(0, Math.round(rawY - 5));

    addControl(bandId, {
      ...defaults,
      type: controlType, x: dropX, y: dropY, width, height,
      fieldName: controlType === 'SubReport' ? undefined : fieldName || defaults.fieldName,
      ...(controlType === 'SubReport' ? {
        subReportBinding: fieldName || '',
        subReportDefinition: createSubReportForFields(schemaField(activeSchema.detailFields, fieldName)?.label ?? '子報表', schemaField(activeSchema.detailFields, fieldName)?.children ?? [], getSubReportGeometry({ width } as ControlDefinition).width),
      } : {}),
      text: fieldName ? '[' + fieldName + ']' : defaults.text,
      style: { fontSize: 9, color: '#0f172a', textAlign: 'left', ...defaults.style },
    });
  };



  // Available dataset fields for grouping selector
  const sampleFields = activeSchema.detailFields.filter(field => field.type !== 'array').map(field => field.name);

  // Check if current report has grouping bands
  const hasGrouping = bands.some((b) => b.type === 'GroupHeader' || b.type === 'GroupFooter');

  // Contextual Action: Add GroupHeader and GroupFooter wrapping Detail
  const handleAddGrouping = (defaultField = sampleFields[0]) => {
    const detailIndex = bands.findIndex((b) => b.type === 'Detail');
    if (detailIndex === -1 || !defaultField) return;

    const numeric = activeReport.calculatedFields?.find(field => field.scope === 'row' && field.type === 'number');
    const aggregateField = numeric ? `calc.${numeric.name}` : activeSchema.detailFields.find(field => field.type === 'number')?.name;
    const groupHeader: BandDefinition = {
      id: createUniqueId('band-group-header'),
      type: 'GroupHeader',
      height: 20,
      groupBy: defaultField,
      groupSortOrder: 'asc',
      controls: [
        {
          id: createUniqueId('ctl-gh-title'),
          type: 'Label',
          x: 6,
          y: 3,
          width: contentWidth*0.3,
          height: 14,
          text: locale === 'zh-TW' ? '【 群組 】' : '[ Group ]',
          style: {
            fontSize: 8.5,
            fontWeight: 'bold',
            color: '#0f172a',
          },
        },
        {
          id: createUniqueId('ctl-gh-category'),
          type: 'Field',
          fieldName: defaultField,
          x: contentWidth*0.35,
          y: 3,
          width: contentWidth*0.6,
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
      id: createUniqueId('band-group-footer'),
      type: 'GroupFooter',
      height: 18,
      groupBy: defaultField,
      groupSortOrder: 'asc',
      controls: [
        {
          id: createUniqueId('ctl-gf-line'),
          type: 'Line',
          x: 0,
          y: 0,
          width: contentWidth,
          height: 0.5,
          style: { color: '#e2e8f0' },
        },
        {
          id: createUniqueId('ctl-gf-label'),
          type: 'Label',
          x: contentWidth*0.5,
          y: 3,
          width: contentWidth*0.3,
          height: 12,
          text: locale === 'zh-TW' ? (aggregateField ? '群組小計：' : '群組筆數：') : (aggregateField ? 'Group subtotal:' : 'Group count:'),
          style: {
            fontSize: 8,
            color: '#64748b',
            textAlign: 'right',
          },
        },
        {
          id: createUniqueId('ctl-gf-sum'),
          type: 'Expression',
          expression: aggregateField ? `=SUM(${aggregateField})` : `=COUNT(${defaultField})`,
          formatString: 'C0',
          x: contentWidth*0.8,
          y: 3,
          width: contentWidth*0.2,
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

    updateActiveReport(active => ({ ...active, bands: newBands }));
    selectControl(groupHeader.id, null);
  };

  // Contextual Action: Remove both GroupHeader and GroupFooter
  const handleRemoveGrouping = () => {
    const updated = bands.filter(
      (b) => b.type !== 'GroupHeader' && b.type !== 'GroupFooter'
    );
    updateActiveReport(active => ({ ...active, bands: updated }));
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
    updateActiveReport(active => ({ ...active, bands: updated }));
  };

  // Shared band appearance.
  const defaultMeta = {
    dotColor: 'bg-slate-500',
    stripBg: 'bg-slate-100 hover:bg-slate-200/90 text-slate-800',
    textColor: 'text-slate-800',
    border: 'border-slate-300',
  };

  const getBandDisplayName = (type: BandDefinition['type']) => {
    return getBandName(type, locale);
  };

  return (
    <main
      ref={canvas}
      className="flex-1 overflow-auto bg-slate-200/80 p-8 flex justify-center items-start select-none dark:bg-slate-950/80 designer-grid"
      onMouseDown={event => {
        if (!(event.target as HTMLElement).closest('input,textarea,select,button,a')) (event.currentTarget.closest('.report-engine-designer') as HTMLElement)?.focus();
      }}
      onClickCapture={event => { if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; } }}
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
                <span>{tControls('SubReport')}</span>
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
              {locale === 'zh-TW' ? '返回主報表' : 'Back to Main Report'}
            </Button>
          </div>
        )}

        {/* Paper Container: ALWAYS pure white paper with realistic sheet shadow */}
        <div
          className="bg-white shadow-2xl border border-slate-300/80 rounded-xs overflow-hidden text-slate-900 relative"
          style={{
            width: `${pageWidth}pt`,
            minHeight: `${pageHeight}pt`,
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
              const meta = {
                ...defaultMeta,
                nameTw: getBandDisplayName(band.type),
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
                          <span>{tBands('groupBy')}:</span>
                          <select
                            value={band.groupBy || sampleFields[0] || ''}
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
                          title={locale === 'zh-TW' ? '在資料列上下加入群組表頭與群組小計' : 'Add group header and footer around detail rows'}
                        >
                          <Plus className="h-3 w-3" />
                          <span>{locale === 'zh-TW' ? '新增分組小計' : 'Add Grouping'}</span>
                        </button>
                      )}

                      {/* Detail indicator if grouping is active */}
                      {band.type === 'Detail' && hasGrouping && (
                        <span className="flex items-center space-x-1 text-[9px] text-slate-700 bg-slate-200/70 border border-slate-300 px-1.5 py-0.2 rounded font-sans">
                          <FolderTree className="h-2.5 w-2.5 text-slate-500" />
                          <span>{locale === 'zh-TW' ? '群組明細列' : 'Group Details'}</span>
                        </span>
                      )}

                      {/* Contextual Action: Remove Grouping from GroupHeader or GroupFooter */}
                      {(band.type === 'GroupHeader' || band.type === 'GroupFooter') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(locale === 'zh-TW' ? '確定要移除此分組結構 (包含群組表頭與小計) 嗎？' : 'Are you sure you want to remove this grouping?')) {
                              handleRemoveGrouping();
                            }
                          }}
                          className="inline-flex items-center space-x-0.5 text-[9px] text-slate-500 hover:text-red-600 hover:bg-slate-200/80 px-1.5 py-0.5 rounded transition-colors border border-transparent hover:border-slate-300"
                          title={locale === 'zh-TW' ? '移除群組結構' : 'Remove grouping'}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          <span>{locale === 'zh-TW' ? '移除分組' : 'Remove Grouping'}</span>
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
                    data-band-id={band.id}
                    style={{
                      height: `${band.height}pt`,
                      width: '100%',
                    }}
                  >
                    {/* Visual Drop Guide Indicator when hovering with dragged control */}
                    {dragOverBandId === band.id && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center border-2 border-dashed border-blue-500/80 bg-blue-50/20 z-30">
                        <span className="text-[11px] font-semibold text-blue-700 bg-white/95 px-2.5 py-1 rounded-md shadow-xs border border-blue-200 font-mono">
                          {locale === 'zh-TW' ? '釋放滑鼠以放置控制項於此處' : 'Drop control here'}
                        </span>
                      </div>
                    )}
                    {/* Render Controls inside Band using standardized registry */}
                    {band.controls.map((control) => {
                      const isControlSelected = selectedBandId === band.id && selectedControlIds.includes(control.id);
                      const plugin = controlRegistry.get(control.type);
                      const baseStyle = mapDesignerControlStyle(control);

                      return (
                        <div
                          key={control.id}
                          data-control-id={control.id}
                          title={control.visibleWhen || control.styleRules?.length ? (locale === 'zh-TW' ? '含條件式列印設定；輸出以 PDF 為準' : 'Conditional printing configured; see PDF output') : undefined}
                          aria-selected={isControlSelected}
                          onMouseDown={(e) => handleControlMouseDown(e, band.id, control)}
                          onClick={(e) => {
                            e.stopPropagation();
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
                          {isControlSelected && selectedControlIds.length === 1 && (() => {
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
                                    title={locale === 'zh-TW' ? '拖曳調整線條長度 (左端)' : 'Drag to adjust line (left)'}
                                  />
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 'e')}
                                    className={`absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 ${handleStyle} cursor-ew-resize`}
                                    title={locale === 'zh-TW' ? '拖曳調整線條長度 (右端)' : 'Drag to adjust line (right)'}
                                  />
                                  {resizingControl?.controlId === control.id && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-40 whitespace-nowrap">
                                      {locale === 'zh-TW' ? '寬度: ' : 'Width: '}{control.width} pt
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
                                    title={locale === 'zh-TW' ? '拖曳調整線條長度 (頂端)' : 'Drag to adjust line (top)'}
                                  />
                                  <div
                                    onMouseDown={(e) => handleResizeMouseDown(e, band.id, control, 's')}
                                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 ${handleStyle} cursor-ns-resize`}
                                    title={locale === 'zh-TW' ? '拖曳調整線條長度 (底端)' : 'Drag to adjust line (bottom)'}
                                  />
                                  {resizingControl?.controlId === control.id && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-40 whitespace-nowrap">
                                      {locale === 'zh-TW' ? '高度: ' : 'Height: '}{control.height} pt
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
                      title={locale === 'zh-TW' ? '拖曳以調整 Band 高度' : 'Drag to adjust band height'}
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
