import { create } from 'zustand';
import type { ReportDefinition, BandDefinition, ControlDefinition } from '../types/report';
import type { ReportDataSource } from '../types/datasource';
import { sampleOrderReport, sampleOrderData, sampleOrderDataSource } from '../mock/sampleReport';
import { createDefaultSubReportDefinition } from '../report/defaultSubReport';
import { deleteControl, getActiveReport, patchControl, updateReportBand, updateReportScope, type SubReportPath } from '../report/operations';
import { parseReport } from '../report/schema';
import { getSubReportRows } from '../report/subReport';

export type ReportTab = 'designer' | 'preview' | 'schema' | 'agent' | 'formulas';

interface ReportState {
  report: ReportDefinition;
  dataSource: ReportDataSource;
  data: Record<string, unknown>[];
  selectedBandId: string | null;
  selectedControlId: string | null;
  activeTab: ReportTab;
  zoom: number;
  editingSubReportPath: SubReportPath | null;
  setActiveTab: (tab: ReportTab) => void;
  selectControl: (bandId: string | null, controlId: string | null) => void;
  enterSubReportEditor: (bandId: string, controlId: string) => void;
  exitSubReportEditor: () => void;
  getActiveReport: () => ReportDefinition;
  getActiveData: () => Record<string, unknown>[];
  updateActiveReport: (transform: (report: ReportDefinition) => ReportDefinition) => void;
  updateBand: (bandId: string, patch: Partial<BandDefinition>) => void;
  updateControl: (bandId: string, controlId: string, patch: Partial<ControlDefinition>) => void;
  addControl: (bandId: string, control: Omit<ControlDefinition, 'id'>) => void;
  removeControl: (bandId: string, controlId: string) => void;
  updateBandHeight: (bandId: string, height: number) => void;
  setBandControls: (bandId: string, controls: ControlDefinition[]) => void;
  setZoom: (zoom: number) => void;
  resetToSample: () => void;
  setReport: (report: ReportDefinition) => void;
  setDataSource: (dataSource: ReportDataSource) => void;
  setData: (data: Record<string, unknown>[]) => void;
}

const emptySelection = { selectedBandId: null, selectedControlId: null };

export const useReportStore = create<ReportState>((set, get) => ({
  report: structuredClone(sampleOrderReport),
  dataSource: sampleOrderDataSource,
  data: sampleOrderData,
  ...emptySelection,
  activeTab: 'designer',
  zoom: 1,
  editingSubReportPath: null,
  setActiveTab: activeTab => set({ activeTab }),
  selectControl: (selectedBandId, selectedControlId) => set({ selectedBandId, selectedControlId }),

  enterSubReportEditor: (bandId, controlId) => {
    const state = get();
    // The designer currently supports one nested canvas level.
    if (state.editingSubReportPath) return;
    const control = state.report.bands.find(b => b.id === bandId)?.controls.find(c => c.id === controlId);
    if (control?.type !== 'SubReport') return;
    const report = control.subReportDefinition ? state.report : patchControl(state.report, bandId, controlId, {
      subReportDefinition: createDefaultSubReportDefinition(control.subReportTitle),
    });
    set({ report, editingSubReportPath: { bandId, controlId }, ...emptySelection });
  },
  exitSubReportEditor: () => set({ editingSubReportPath: null, ...emptySelection }),
  getActiveReport: () => getActiveReport(get().report, get().editingSubReportPath),
  getActiveData: () => {
    const { report, data, editingSubReportPath: path } = get();
    if (!path) return data;
    const control = report.bands.find(b => b.id === path.bandId)?.controls.find(c => c.id === path.controlId);
    if (!control) return [];
    for (const row of data) {
      const rows = getSubReportRows(control, { currentRow: row });
      if (rows.length) return rows;
    }
    return [];
  },
  updateActiveReport: transform => set(state => ({
    report: updateReportScope(state.report, transform, state.editingSubReportPath?.controlId),
  })),
  updateBand: (bandId, patch) => get().updateActiveReport(report =>
    updateReportBand(report, bandId, band => ({ ...band, ...patch, id: band.id }))),
  updateControl: (bandId, controlId, patch) => get().updateActiveReport(report =>
    patchControl(report, bandId, controlId, patch)),
  addControl: (bandId, control) => {
    const id = 'ctl-' + crypto.randomUUID();
    get().updateActiveReport(report => updateReportBand(report, bandId, band => ({
      ...band, controls: [...band.controls, { ...control, id }],
    })));
    set({ selectedBandId: bandId, selectedControlId: id });
  },
  removeControl: (bandId, controlId) => {
    get().updateActiveReport(report => deleteControl(report, bandId, controlId));
    if (get().selectedBandId === bandId && get().selectedControlId === controlId) set({ selectedControlId: null });
  },
  updateBandHeight: (bandId, height) => {
    if (Number.isFinite(height)) get().updateBand(bandId, { height: Math.max(10, height) });
  },
  setBandControls: (bandId, controls) => {
    get().updateBand(bandId, { controls });
    if (get().selectedBandId === bandId) set({ selectedControlId: null });
  },
  setZoom: zoom => { if (Number.isFinite(zoom)) set({ zoom: Math.min(2, Math.max(0.5, zoom)) }); },
  resetToSample: () => set({
    report: structuredClone(sampleOrderReport), dataSource: sampleOrderDataSource, data: sampleOrderData,
    editingSubReportPath: null, ...emptySelection,
  }),
  setReport: report => set(state => {
    const validated = parseReport(report);
    const path = state.editingSubReportPath;
    const stillExists = path && validated.bands.find(b => b.id === path.bandId)?.controls
      .some(c => c.id === path.controlId && c.type === 'SubReport' && c.subReportDefinition);
    const editingSubReportPath = stillExists ? path : null;
    const active = getActiveReport(validated, editingSubReportPath);
    const band = active.bands.find(b => b.id === state.selectedBandId);
    return {
      report: validated, editingSubReportPath,
      selectedBandId: band?.id ?? null,
      selectedControlId: band?.controls.find(c => c.id === state.selectedControlId)?.id ?? null,
    };
  }),
  setDataSource: dataSource => set({ dataSource, data: dataSource.data.items || [] }),
  setData: data => set(state => ({ data, dataSource: {
    ...state.dataSource, data: { ...state.dataSource.data, items: data },
  } })),
}));
