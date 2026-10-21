import { create } from 'zustand';
import type { ReportDefinition, ControlDefinition } from '../types/report';
import type { ReportDataSource } from '../types/datasource';
import { sampleOrderReport, sampleOrderData, sampleOrderDataSource } from '../mock/sampleReport';

export type ReportTab = 'designer' | 'preview' | 'schema' | 'agent';

export function createDefaultSubReportDefinition(title = '序號與檢驗明細'): ReportDefinition {
  return {
    id: `subreport-${Date.now()}`,
    name: title,
    pageSettings: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    bands: [
      {
        id: 'sub-band-header',
        type: 'PageHeader',
        height: 16,
        controls: [
          {
            id: 'sub-th-sn',
            type: 'Label',
            x: 4,
            y: 0,
            width: 105,
            height: 16,
            text: '出廠序號 (S/N)',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-barcode',
            type: 'Label',
            x: 112,
            y: 0,
            width: 110,
            height: 16,
            text: '序號條碼 (CODE128)',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-lot',
            type: 'Label',
            x: 226,
            y: 0,
            width: 85,
            height: 16,
            text: '生產批號',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-location',
            type: 'Label',
            x: 315,
            y: 0,
            width: 75,
            height: 16,
            text: '出貨儲位',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-qc',
            type: 'Label',
            x: 395,
            y: 0,
            width: 75,
            height: 16,
            text: '品檢結果',
            style: { fontSize: 7, fontWeight: 'bold', textAlign: 'right', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2, paddingHorizontal: 6 },
          },
        ],
      },
      {
        id: 'sub-band-detail',
        type: 'Detail',
        height: 22,
        controls: [
          {
            id: 'sub-td-sn',
            type: 'Field',
            x: 4,
            y: 2,
            width: 105,
            height: 18,
            fieldName: 'serialNo',
            style: { fontSize: 7, color: '#0f172a' },
          },
          {
            id: 'sub-td-barcode',
            type: 'Barcode',
            x: 112,
            y: 1,
            width: 110,
            height: 19,
            fieldName: 'serialNo',
            barcodeFormat: 'CODE128',
            displayValue: false,
          },
          {
            id: 'sub-td-lot',
            type: 'Field',
            x: 226,
            y: 2,
            width: 85,
            height: 18,
            fieldName: 'lotNo',
            style: { fontSize: 7, color: '#475569' },
          },
          {
            id: 'sub-td-location',
            type: 'Field',
            x: 315,
            y: 2,
            width: 75,
            height: 18,
            fieldName: 'location',
            style: { fontSize: 7, color: '#475569' },
          },
          {
            id: 'sub-td-qc',
            type: 'Field',
            x: 395,
            y: 2,
            width: 75,
            height: 18,
            fieldName: 'qcStatus',
            style: { fontSize: 7, fontWeight: 'bold', color: '#059669', textAlign: 'right', paddingHorizontal: 6 },
          },
        ],
      },
    ],
  };
}

interface ReportState {
  report: ReportDefinition;
  dataSource: ReportDataSource;
  data: Record<string, unknown>[];
  selectedBandId: string | null;
  selectedControlId: string | null;
  activeTab: ReportTab;
  zoom: number;

  // SubReport nested editor state
  editingSubReportPath: { bandId: string; controlId: string } | null;

  // Actions
  setActiveTab: (tab: ReportTab) => void;
  selectControl: (bandId: string | null, controlId: string | null) => void;
  enterSubReportEditor: (bandId: string, controlId: string) => void;
  exitSubReportEditor: () => void;
  getActiveReport: () => ReportDefinition;
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
  setDataSource: (dataSource: ReportDataSource) => void;
  setData: (data: Record<string, unknown>[]) => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  report: sampleOrderReport,
  dataSource: sampleOrderDataSource,
  data: sampleOrderData,
  selectedBandId: null,
  selectedControlId: null,
  activeTab: 'designer',
  zoom: 1,
  editingSubReportPath: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectControl: (bandId, controlId) =>
    set({ selectedBandId: bandId, selectedControlId: controlId }),

  enterSubReportEditor: (bandId, controlId) => {
    // Ensure the control has an inline subReportDefinition initialized
    const state = get();
    const parentBand = state.report.bands.find((b) => b.id === bandId);
    const subCtrl = parentBand?.controls.find((c) => c.id === controlId);

    if (subCtrl && !subCtrl.subReportDefinition) {
      const defaultDef = createDefaultSubReportDefinition(subCtrl.subReportTitle);
      state.updateControl(bandId, controlId, { subReportDefinition: defaultDef });
    }

    set({
      editingSubReportPath: { bandId, controlId },
      selectedBandId: null,
      selectedControlId: null,
    });
  },

  exitSubReportEditor: () =>
    set({
      editingSubReportPath: null,
      selectedBandId: null,
      selectedControlId: null,
    }),

  getActiveReport: () => {
    const state = get();
    if (!state.editingSubReportPath) return state.report;

    const { bandId, controlId } = state.editingSubReportPath;
    const parentBand = state.report.bands.find((b) => b.id === bandId);
    const subCtrl = parentBand?.controls.find((c) => c.id === controlId);

    return subCtrl?.subReportDefinition || createDefaultSubReportDefinition(subCtrl?.subReportTitle);
  },

  updateControl: (bandId, controlId, patch) =>
    set((state) => {
      // 1. If currently inside SubReport editor
      if (state.editingSubReportPath) {
        const { bandId: pBandId, controlId: pCtrlId } = state.editingSubReportPath;
        return {
          report: {
            ...state.report,
            bands: state.report.bands.map((b) => {
              if (b.id !== pBandId) return b;
              return {
                ...b,
                controls: b.controls.map((c) => {
                  if (c.id !== pCtrlId) return c;
                  const currentSubDef = c.subReportDefinition || createDefaultSubReportDefinition(c.subReportTitle);
                  return {
                    ...c,
                    subReportDefinition: {
                      ...currentSubDef,
                      bands: currentSubDef.bands.map((subBand) => {
                        if (subBand.id !== bandId) return subBand;
                        return {
                          ...subBand,
                          controls: subBand.controls.map((ctrl) =>
                            ctrl.id === controlId
                              ? { ...ctrl, ...patch, style: { ...ctrl.style, ...patch.style } }
                              : ctrl
                          ),
                        };
                      }),
                    },
                  };
                }),
              };
            }),
          },
        };
      }

      // 2. Main report mode
      return {
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
      };
    }),

  addControl: (bandId, controlData) =>
    set((state) => {
      const newId = `ctl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newControl: ControlDefinition = {
        ...controlData,
        id: newId,
      };

      // 1. SubReport editor mode
      if (state.editingSubReportPath) {
        const { bandId: pBandId, controlId: pCtrlId } = state.editingSubReportPath;
        return {
          selectedBandId: bandId,
          selectedControlId: newId,
          report: {
            ...state.report,
            bands: state.report.bands.map((b) => {
              if (b.id !== pBandId) return b;
              return {
                ...b,
                controls: b.controls.map((c) => {
                  if (c.id !== pCtrlId) return c;
                  const currentSubDef = c.subReportDefinition || createDefaultSubReportDefinition(c.subReportTitle);
                  return {
                    ...c,
                    subReportDefinition: {
                      ...currentSubDef,
                      bands: currentSubDef.bands.map((subBand) =>
                        subBand.id === bandId
                          ? { ...subBand, controls: [...subBand.controls, newControl] }
                          : subBand
                      ),
                    },
                  };
                }),
              };
            }),
          },
        };
      }

      // 2. Main report mode
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
    set((state) => {
      // 1. SubReport editor mode
      if (state.editingSubReportPath) {
        const { bandId: pBandId, controlId: pCtrlId } = state.editingSubReportPath;
        return {
          selectedControlId: state.selectedControlId === controlId ? null : state.selectedControlId,
          report: {
            ...state.report,
            bands: state.report.bands.map((b) => {
              if (b.id !== pBandId) return b;
              return {
                ...b,
                controls: b.controls.map((c) => {
                  if (c.id !== pCtrlId) return c;
                  const currentSubDef = c.subReportDefinition || createDefaultSubReportDefinition(c.subReportTitle);
                  return {
                    ...c,
                    subReportDefinition: {
                      ...currentSubDef,
                      bands: currentSubDef.bands.map((subBand) =>
                        subBand.id === bandId
                          ? { ...subBand, controls: subBand.controls.filter((ctrl) => ctrl.id !== controlId) }
                          : subBand
                      ),
                    },
                  };
                }),
              };
            }),
          },
        };
      }

      // 2. Main report mode
      return {
        selectedControlId: state.selectedControlId === controlId ? null : state.selectedControlId,
        report: {
          ...state.report,
          bands: state.report.bands.map((band) =>
            band.id === bandId
              ? { ...band, controls: band.controls.filter((c) => c.id !== controlId) }
              : band
          ),
        },
      };
    }),

  updateBandHeight: (bandId, height) =>
    set((state) => {
      const sanitizedHeight = Math.max(10, height);

      // 1. SubReport editor mode
      if (state.editingSubReportPath) {
        const { bandId: pBandId, controlId: pCtrlId } = state.editingSubReportPath;
        return {
          report: {
            ...state.report,
            bands: state.report.bands.map((b) => {
              if (b.id !== pBandId) return b;
              return {
                ...b,
                controls: b.controls.map((c) => {
                  if (c.id !== pCtrlId) return c;
                  const currentSubDef = c.subReportDefinition || createDefaultSubReportDefinition(c.subReportTitle);
                  return {
                    ...c,
                    subReportDefinition: {
                      ...currentSubDef,
                      bands: currentSubDef.bands.map((subBand) =>
                        subBand.id === bandId ? { ...subBand, height: sanitizedHeight } : subBand
                      ),
                    },
                  };
                }),
              };
            }),
          },
        };
      }

      // 2. Main report mode
      return {
        report: {
          ...state.report,
          bands: state.report.bands.map((band) =>
            band.id === bandId ? { ...band, height: sanitizedHeight } : band
          ),
        },
      };
    }),

  setBandControls: (bandId, controls) =>
    set((state) => {
      // 1. SubReport editor mode
      if (state.editingSubReportPath) {
        const { bandId: pBandId, controlId: pCtrlId } = state.editingSubReportPath;
        return {
          report: {
            ...state.report,
            bands: state.report.bands.map((b) => {
              if (b.id !== pBandId) return b;
              return {
                ...b,
                controls: b.controls.map((c) => {
                  if (c.id !== pCtrlId) return c;
                  const currentSubDef = c.subReportDefinition || createDefaultSubReportDefinition(c.subReportTitle);
                  return {
                    ...c,
                    subReportDefinition: {
                      ...currentSubDef,
                      bands: currentSubDef.bands.map((subBand) =>
                        subBand.id === bandId ? { ...subBand, controls } : subBand
                      ),
                    },
                  };
                }),
              };
            }),
          },
        };
      }

      // 2. Main report mode
      return {
        report: {
          ...state.report,
          bands: state.report.bands.map((band) =>
            band.id === bandId ? { ...band, controls } : band
          ),
        },
      };
    }),

  setZoom: (zoom) => set({ zoom }),

  resetToSample: () => {
    set({
      report: sampleOrderReport,
      dataSource: sampleOrderDataSource,
      data: sampleOrderData,
      selectedBandId: null,
      selectedControlId: null,
      editingSubReportPath: null,
    });
  },

  setReport: (report) => set({ report }),

  setDataSource: (dataSource) =>
    set({
      dataSource,
      data: dataSource.data.items || [],
    }),

  setData: (data) =>
    set((state) => ({
      data,
      dataSource: {
        ...state.dataSource,
        data: {
          ...state.dataSource.data,
          items: data,
        },
      },
    })),
}));
