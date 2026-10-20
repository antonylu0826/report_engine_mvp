import { create } from 'zustand';
import type { ReportDefinition, ControlDefinition } from '../types/report';
import { sampleOrderReport, sampleOrderData } from '../mock/sampleReport';

export type ReportTab = 'designer' | 'preview' | 'schema' | 'agent';

interface ReportState {
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
  setBandControls: (bandId: string, controls: ControlDefinition[]) => void;
  setZoom: (zoom: number) => void;
  resetToSample: () => void;
  setReport: (report: ReportDefinition) => void;
  setData: (data: Record<string, unknown>[]) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  report: sampleOrderReport,
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
              ctrl.id === controlId
                ? { ...ctrl, ...patch, style: { ...ctrl.style, ...patch.style } }
                : ctrl
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

  setBandControls: (bandId, controls) =>
    set((state) => ({
      report: {
        ...state.report,
        bands: state.report.bands.map((band) =>
          band.id === bandId ? { ...band, controls } : band
        ),
      },
    })),

  setZoom: (zoom) => set({ zoom }),

  resetToSample: () => {
    set({
      report: sampleOrderReport,
      data: sampleOrderData,
      selectedBandId: null,
      selectedControlId: null,
    });
  },

  setReport: (report) => set({ report }),

  setData: (data) => set({ data }),
}));
