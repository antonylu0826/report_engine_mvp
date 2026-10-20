import { create } from 'zustand';
import type { ReportDefinition, ControlDefinition } from '../types/report';
import { sampleOrderData } from '../mock/sampleReport';
import type { SemanticReportSpec } from '../semantic/types';
import { defaultSemanticSpec } from '../semantic/sampleSpec';
import { compileSemanticSpecToReport } from '../semantic/compiler';

export type ReportTab = 'designer' | 'preview' | 'schema' | 'agent';

interface ReportState {
  spec: SemanticReportSpec;
  report: ReportDefinition;
  data: Record<string, unknown>[];
  selectedBandId: string | null;
  selectedControlId: string | null;
  activeTab: ReportTab;
  zoom: number;

  // Actions
  setActiveTab: (tab: ReportTab) => void;
  selectControl: (bandId: string | null, controlId: string | null) => void;
  updateControl: (
    bandId: string,
    controlId: string,
    patch: Partial<ControlDefinition>
  ) => void;
  addControl: (bandId: string, control: Omit<ControlDefinition, 'id'>) => void;
  removeControl: (bandId: string, controlId: string) => void;
  updateBandHeight: (bandId: string, height: number) => void;
  setZoom: (zoom: number) => void;
  resetToSample: () => void;
  setReport: (report: ReportDefinition) => void;
  setData: (data: Record<string, unknown>[]) => void;

  // Agent Native Spec Actions
  setSpec: (spec: SemanticReportSpec) => void;
  applyAgentMutation: (
    mutationFn: (prev: SemanticReportSpec) => SemanticReportSpec
  ) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  spec: defaultSemanticSpec,
  report: compileSemanticSpecToReport(defaultSemanticSpec),
  data: sampleOrderData,
  selectedBandId: null,
  selectedControlId: null,
  activeTab: 'designer',
  zoom: 1,

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectControl: (bandId, controlId) =>
    set({ selectedBandId: bandId, selectedControlId: controlId }),

  updateControl: (bandId, controlId, patch) =>
    set((state) => ({
      report: {
        ...state.report,
        bands: state.report.bands.map((band) => {
          if (band.id !== bandId) return band;
          return {
            ...band,
            controls: band.controls.map((ctrl) =>
              ctrl.id === controlId ? { ...ctrl, ...patch, style: { ...ctrl.style, ...patch.style } } : ctrl
            ),
          };
        }),
      },
    })),

  addControl: (bandId, controlData) =>
    set((state) => {
      const newId = `ctl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newControl: ControlDefinition = {
        ...controlData,
        id: newId,
      };
      return {
        selectedBandId: bandId,
        selectedControlId: newId,
        report: {
          ...state.report,
          bands: state.report.bands.map((band) =>
            band.id === bandId
              ? { ...band, controls: [...band.controls, newControl] }
              : band
          ),
        },
      };
    }),

  removeControl: (bandId, controlId) =>
    set((state) => ({
      selectedControlId: state.selectedControlId === controlId ? null : state.selectedControlId,
      report: {
        ...state.report,
        bands: state.report.bands.map((band) =>
          band.id === bandId
            ? { ...band, controls: band.controls.filter((c) => c.id !== controlId) }
            : band
        ),
      },
    })),

  updateBandHeight: (bandId, height) =>
    set((state) => ({
      report: {
        ...state.report,
        bands: state.report.bands.map((band) =>
          band.id === bandId ? { ...band, height: Math.max(10, height) } : band
        ),
      },
    })),

  setZoom: (zoom) => set({ zoom }),

  resetToSample: () => {
    const compiled = compileSemanticSpecToReport(defaultSemanticSpec);
    set({
      spec: defaultSemanticSpec,
      report: compiled,
      data: sampleOrderData,
      selectedBandId: null,
      selectedControlId: null,
    });
  },

  setReport: (report) => set({ report }),

  setData: (data) => set({ data }),

  setSpec: (spec) => {
    const compiled = compileSemanticSpecToReport(spec);
    set({ spec, report: compiled });
  },

  applyAgentMutation: (mutationFn) => {
    set((state) => {
      const nextSpec = mutationFn(state.spec);
      const nextReport = compileSemanticSpecToReport(nextSpec);
      return { spec: nextSpec, report: nextReport };
    });
  },
}));
