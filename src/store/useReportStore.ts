import type { ReportDiagnostic } from '../types/diagnostics';
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createContext, useContext } from "react";
import type { ReportDocument } from "../types/document";
import { parseReportDocument } from "../report/document";
import { parseDataSource } from "../data/schema";
import { getPageGeometry, getSubReportGeometry } from "../report/geometry";
import type {
  ReportDefinition,
  BandDefinition,
  ControlDefinition,
} from "../types/report";
import type { ReportDataSource } from "../types/datasource";
import { createSubReportForFields } from "../report/defaultSubReport";
import {
  deleteControl,
  getActiveReport,
  patchControl,
  updateReportBand,
  updateReportScope,
  type SubReportPath,
} from "../report/operations";
import { parseReport } from "../report/schema";
import { childSchema } from "../report/dataSchema";
import { getSubReportRows } from "../report/subReport";

export type ReportTab =
  "designer" | "preview" | "schema" | "agent" | "formulas" | "data" | "preflight";

export interface ReportState {
  diagnosticNavigationRevision: number;
  focusDiagnostic: (diagnostic: ReportDiagnostic) => void;
  selectedControlIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  beginTransaction: () => void;
  endTransaction: () => void;
  undo: () => void;
  redo: () => void;
  getDocument: () => ReportDocument;
  setDocument: (document: ReportDocument, external?: boolean) => void;
  toggleControl: (bandId: string, controlId: string) => void;
  selectAll: () => void;
  copySelection: () => void;
  pasteSelection: () => void;
  deleteSelection: () => void;
  moveSelection: (dx: number, dy: number) => void;
  arrangeSelection: (mode: ArrangeMode) => void;
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
  updateActiveReport: (
    transform: (report: ReportDefinition) => ReportDefinition,
  ) => void;
  updateBand: (bandId: string, patch: Partial<BandDefinition>) => void;
  updateControl: (
    bandId: string,
    controlId: string,
    patch: Partial<ControlDefinition>,
  ) => void;
  addControl: (bandId: string, control: Omit<ControlDefinition, "id">) => void;
  removeControl: (bandId: string, controlId: string) => void;
  updateBandHeight: (bandId: string, height: number) => void;
  setBandControls: (bandId: string, controls: ControlDefinition[]) => void;
  setZoom: (zoom: number) => void;
  resetToSample: () => void;
  setReport: (report: ReportDefinition) => void;
  setDataSource: (dataSource: ReportDataSource) => void;
  setData: (data: Record<string, unknown>[]) => void;
}

export type ArrangeMode =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "horizontal"
  | "vertical";
const emptySelection = {
  selectedBandId: null,
  selectedControlId: null,
  selectedControlIds: [] as string[],
};
function freshControl(control: ControlDefinition): ControlDefinition {
  const clone = structuredClone(control);
  clone.id = "ctl-" + crypto.randomUUID();
  if (clone.subReportDefinition) {
    clone.subReportDefinition.id = "report-" + crypto.randomUUID();
    clone.subReportDefinition.bands = clone.subReportDefinition.bands.map(
      (band) => ({
        ...band,
        id: "band-" + crypto.randomUUID(),
        controls: band.controls.map(freshControl),
      }),
    );
  }
  return clone;
}

function sameDocument(left: ReportDocument, right: ReportDocument): boolean {
  return (left.report === right.report || JSON.stringify(left.report) === JSON.stringify(right.report)) &&
    (left.dataSource === right.dataSource || JSON.stringify(left.dataSource) === JSON.stringify(right.dataSource));
}

export function createReportStore(initial: ReportDocument) {
  const start = parseReportDocument(structuredClone(initial));
  const past: ReportDocument[] = [],
    future: ReportDocument[] = [];
  let transaction: ReportDocument | undefined,
    clipboard: ControlDefinition[] = [];
  let document = start;
  const store = createStore<ReportState>((set, get) => {
    const snapshot = () => {
      const state = get();
      if (
        document.report !== state.report ||
        document.dataSource !== state.dataSource
      )
        document = {
          formatVersion: 1,
          report: state.report,
          dataSource: state.dataSource,
        };
      return document;
    };
    const navigation = (report: ReportDefinition) => {
      const state = get(),
        path = state.editingSubReportPath;
      const editingSubReportPath =
        path &&
        report.bands
          .find((b) => b.id === path.bandId)
          ?.controls.some(
            (c) => c.id === path.controlId && c.subReportDefinition,
          )
          ? path
          : null;
      const band = getActiveReport(report, editingSubReportPath).bands.find(
        (b) => b.id === state.selectedBandId,
      );
      const selectedControlIds = state.selectedControlIds.filter((id) =>
        band?.controls.some((c) => c.id === id),
      );
      return {
        editingSubReportPath,
        selectedBandId: band?.id ?? null,
        selectedControlIds,
        selectedControlId: selectedControlIds.at(-1) ?? null,
      };
    };
    const flags = () => ({
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    });
    const apply = (next: ReportDocument) => {
      if (sameDocument(next, snapshot())) return;
      if (!transaction) {
        past.push(snapshot());
        if (past.length > 100) past.shift();
      }
      future.length = 0;
      set({
        report: next.report,
        dataSource: next.dataSource,
        data: next.dataSource.data.items,
        ...flags(),
      });
    };
    const activeWidth = () => {
      const state = get(),
        path = state.editingSubReportPath;
      const parent =
        path &&
        state.report.bands
          .find((b) => b.id === path.bandId)
          ?.controls.find((c) => c.id === path.controlId);
      return parent
        ? getSubReportGeometry(parent).width
        : getPageGeometry(state.report.pageSettings).printableWidth;
    };
    const selected = () =>
      get()
        .getActiveReport()
        .bands.find((b) => b.id === get().selectedBandId)
        ?.controls.filter((c) => get().selectedControlIds.includes(c.id)) ?? [];
    const patchSelected = (
      patch: (control: ControlDefinition, index: number) => ControlDefinition,
    ) => {
      const ids = get().selectedControlIds;
      const bandId = get().selectedBandId;
      if (!bandId || !ids.length) return;
      get().updateActiveReport((report) =>
        updateReportBand(report, bandId, (band) => ({
          ...band,
          controls: band.controls.map((c) =>
            ids.includes(c.id) ? patch(c, ids.indexOf(c.id)) : c,
          ),
        })),
      );
    };
    return {
      diagnosticNavigationRevision: 0,
      focusDiagnostic: diagnostic => {
        const root=get().report, parents=diagnostic.subReportControlPath ?? [];
        let active=root, editingSubReportPath: SubReportPath|null=null;
        if(parents.length) {
          const band=root.bands.find(b=>b.controls.some(c=>c.id===parents[0]));
          const child=band?.controls.find(c=>c.id===parents[0]);
          if(band && child?.subReportDefinition){editingSubReportPath={bandId:band.id,controlId:child.id};active=child.subReportDefinition;}
        }
        const target=parents.length>1?parents[1]:diagnostic.controlId;
        const band=target?active.bands.find(b=>b.controls.some(c=>c.id===target)):active.bands.find(b=>b.id===diagnostic.bandId);
        const selectedControlId=band?.controls.find(c=>c.id===target)?.id ?? null;
        set({editingSubReportPath,selectedBandId:band?.id ?? null,selectedControlId,selectedControlIds:selectedControlId?[selectedControlId]:[],
          activeTab:diagnostic.category==='data'?'data':!band&&diagnostic.fieldName?'formulas':'designer',diagnosticNavigationRevision:get().diagnosticNavigationRevision+1});
      },
      canUndo: false,
      canRedo: false,
      getDocument: snapshot,
      setDocument: (value, external = false) => {
        const next = parseReportDocument(value);
        if (external) {
          past.length = future.length = 0;
          transaction = undefined;
          set({
            report: next.report,
            dataSource: next.dataSource,
            data: next.dataSource.data.items,
            ...emptySelection,
            editingSubReportPath: null,
            ...flags(),
          });
        } else apply(next);
      },
      beginTransaction: () => {
        transaction ??= snapshot();
      },
      endTransaction: () => {
        if (!transaction) return;
        if (!sameDocument(transaction, snapshot())) {
          past.push(transaction);
          if (past.length > 100) past.shift();
        }
        transaction = undefined;
        set(flags());
      },
      undo: () => {
        get().endTransaction();
        const previous = past.pop();
        if (!previous) return;
        future.push(snapshot());
        set({
          report: previous.report,
          dataSource: previous.dataSource,
          data: previous.dataSource.data.items,
          ...navigation(previous.report),
          ...flags(),
        });
      },
      redo: () => {
        const next = future.pop();
        if (!next) return;
        past.push(snapshot());
        set({
          report: next.report,
          dataSource: next.dataSource,
          data: next.dataSource.data.items,
          ...navigation(next.report),
          ...flags(),
        });
      },
      toggleControl: (bandId, controlId) =>
        set((state) => {
          const ids =
            state.selectedBandId === bandId ? state.selectedControlIds : [];
          const selectedControlIds = ids.includes(controlId)
            ? ids.filter((id) => id !== controlId)
            : [...ids, controlId];
          return {
            selectedBandId: bandId,
            selectedControlIds,
            selectedControlId: selectedControlIds.at(-1) ?? null,
          };
        }),
      selectAll: () => {
        const band = get()
          .getActiveReport()
          .bands.find((b) => b.id === get().selectedBandId);
        if (band)
          set({
            selectedControlIds: band.controls.map((c) => c.id),
            selectedControlId: band.controls.at(-1)?.id ?? null,
          });
      },
      copySelection: () => {
        clipboard = structuredClone(selected());
      },
      pasteSelection: () => {
        const band = get()
          .getActiveReport()
          .bands.find((b) => b.id === get().selectedBandId);
        if (!band || !clipboard.length) return;
        const width = activeWidth();
        const maxRight = Math.max(...clipboard.map((c) => c.x + c.width));
        const dx = Math.min(10, Math.max(0, width - maxRight));
        const copies = clipboard.map((c) => ({
          ...freshControl(c),
          x: c.x + dx,
          y: c.y + 10,
        }));
        get().updateBand(band.id, {
          controls: [...band.controls, ...copies],
          height: Math.max(band.height, ...copies.map((c) => c.y + c.height)),
        });
        set({
          selectedControlIds: copies.map((c) => c.id),
          selectedControlId: copies.at(-1)!.id,
        });
      },
      deleteSelection: () => {
        const ids = get().selectedControlIds,
          bandId = get().selectedBandId;
        if (!bandId || !ids.length) return;
        get().updateActiveReport((report) =>
          updateReportBand(report, bandId, (band) => ({
            ...band,
            controls: band.controls.filter((c) => !ids.includes(c.id)),
          })),
        );
        set({ selectedControlId: null, selectedControlIds: [] });
      },
      moveSelection: (dx, dy) => {
        const controls = selected();
        if (!controls.length) return;
        const width = activeWidth();
        const band = get()
          .getActiveReport()
          .bands.find((b) => b.id === get().selectedBandId)!;
        dx = Math.max(
          -Math.min(...controls.map((c) => c.x)),
          Math.min(
            dx,
            Math.max(
              0,
              width - Math.max(...controls.map((c) => c.x + c.width)),
            ),
          ),
        );
        dy = Math.max(
          -Math.min(...controls.map((c) => c.y)),
          Math.min(
            dy,
            Math.max(
              0,
              band.height - Math.max(...controls.map((c) => c.y + c.height)),
            ),
          ),
        );
        patchSelected((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      },
      arrangeSelection: (mode) => {
        const controls = selected();
        if (controls.length < 2) return;
        const left = Math.min(...controls.map((c) => c.x)),
          right = Math.max(...controls.map((c) => c.x + c.width));
        const top = Math.min(...controls.map((c) => c.y)),
          bottom = Math.max(...controls.map((c) => c.y + c.height));
        const horizontal = mode === "horizontal",
          vertical = mode === "vertical";
        const positions = new Map<string, number>();
        if (horizontal || vertical) {
          if (controls.length < 3) return;
          const ordered = [...controls].sort((a, b) =>
            horizontal ? a.x - b.x : a.y - b.y,
          );
          const total = ordered.reduce(
            (sum, c) => sum + (horizontal ? c.width : c.height),
            0,
          );
          const gap =
            ((horizontal ? right - left : bottom - top) - total) /
            (ordered.length - 1);
          let cursor = horizontal ? left : top;
          for (const c of ordered) {
            positions.set(c.id, cursor);
            cursor += (horizontal ? c.width : c.height) + gap;
          }
        }
        patchSelected((c) => ({
          ...c,
          x: horizontal
            ? positions.get(c.id)!
            : mode === "left"
              ? left
              : mode === "right"
                ? right - c.width
                : mode === "center"
                  ? (left + right - c.width) / 2
                  : c.x,
          y: vertical
            ? positions.get(c.id)!
            : mode === "top"
              ? top
              : mode === "bottom"
                ? bottom - c.height
                : mode === "middle"
                  ? (top + bottom - c.height) / 2
                  : c.y,
        }));
      },
      report: start.report,
      dataSource: start.dataSource,
      data: start.dataSource.data.items,
      ...emptySelection,
      activeTab: "designer",
      zoom: 1,
      editingSubReportPath: null,
      setActiveTab: (activeTab) => set({ activeTab }),
      selectControl: (selectedBandId, selectedControlId) =>
        set({
          selectedBandId,
          selectedControlId,
          selectedControlIds: selectedControlId ? [selectedControlId] : [],
        }),

      enterSubReportEditor: (bandId, controlId) => {
        const state = get();
        // The designer currently supports one nested canvas level.
        if (state.editingSubReportPath) return;
        const control = state.report.bands
          .find((b) => b.id === bandId)
          ?.controls.find((c) => c.id === controlId);
        if (control?.type !== "SubReport") return;
        const report = control.subReportDefinition
          ? state.report
          : patchControl(state.report, bandId, controlId, {
              subReportDefinition: createSubReportForFields(
                control.subReportTitle ?? "子報表",
                childSchema(control, state.dataSource.schema)?.detailFields ??
                  [],
                getSubReportGeometry(control).width,
              ),
            });
        if (report !== state.report) apply({ ...snapshot(), report });
        set({ editingSubReportPath: { bandId, controlId }, ...emptySelection });
      },
      exitSubReportEditor: () =>
        set({ editingSubReportPath: null, ...emptySelection }),
      getActiveReport: () =>
        getActiveReport(get().report, get().editingSubReportPath),
      getActiveData: () => {
        const { report, data, editingSubReportPath: path } = get();
        if (!path) return data;
        const control = report.bands
          .find((b) => b.id === path.bandId)
          ?.controls.find((c) => c.id === path.controlId);
        if (!control) return [];
        for (const row of data) {
          const rows = getSubReportRows(control, { currentRow: row });
          if (rows.length) return rows;
        }
        return [];
      },
      updateActiveReport: (transform) =>
        apply({
          ...snapshot(),
          report: updateReportScope(
            get().report,
            transform,
            get().editingSubReportPath?.controlId,
          ),
        }),
      updateBand: (bandId, patch) =>
        get().updateActiveReport((report) =>
          updateReportBand(report, bandId, (band) => ({
            ...band,
            ...patch,
            id: band.id,
          })),
        ),
      updateControl: (bandId, controlId, patch) =>
        get().updateActiveReport((report) =>
          patchControl(report, bandId, controlId, patch),
        ),
      addControl: (bandId, control) => {
        const id = "ctl-" + crypto.randomUUID();
        const width = Math.min(control.width, activeWidth());
        const placed = {
          ...control,
          width,
          x: Math.max(0, Math.min(control.x, activeWidth() - width)),
        };
        get().updateActiveReport((report) =>
          updateReportBand(report, bandId, (band) => ({
            ...band,
            height: Math.max(band.height, placed.y + placed.height),
            controls: [...band.controls, { ...placed, id }],
          })),
        );
        get().selectControl(bandId, id);
      },
      removeControl: (bandId, controlId) => {
        get().updateActiveReport((report) =>
          deleteControl(report, bandId, controlId),
        );
        if (
          get().selectedBandId === bandId &&
          get().selectedControlId === controlId
        )
          set({ selectedControlId: null });
      },
      updateBandHeight: (bandId, height) => {
        if (Number.isFinite(height))
          get().updateBand(bandId, { height: Math.max(10, height) });
      },
      setBandControls: (bandId, controls) => {
        get().updateBand(bandId, { controls });
        if (get().selectedBandId === bandId) set({ selectedControlId: null });
      },
      setZoom: (zoom) => {
        if (Number.isFinite(zoom))
          set({ zoom: Math.min(2, Math.max(0.5, zoom)) });
      },
      resetToSample: () => {
        apply(structuredClone(start));
        set({ editingSubReportPath: null, ...emptySelection });
      },
      setReport: (report) => {
        const state = get();
        const validated = parseReport(report);
        const path = state.editingSubReportPath;
        const stillExists =
          path &&
          validated.bands
            .find((b) => b.id === path.bandId)
            ?.controls.some(
              (c) =>
                c.id === path.controlId &&
                c.type === "SubReport" &&
                c.subReportDefinition,
            );
        const editingSubReportPath = stillExists ? path : null;
        const active = getActiveReport(validated, editingSubReportPath);
        const band = active.bands.find((b) => b.id === state.selectedBandId);
        apply({ ...snapshot(), report: validated });
        set({
          editingSubReportPath,
          selectedBandId: band?.id ?? null,
          selectedControlId:
            band?.controls.find((c) => c.id === state.selectedControlId)?.id ??
            null,
          selectedControlIds: state.selectedControlIds.filter((id) =>
            band?.controls.some((c) => c.id === id),
          ),
        });
      },
      setDataSource: (dataSource) =>
        get().setDocument({ ...snapshot(), dataSource }),
      setData: (data) =>
        apply({
          ...snapshot(),
          dataSource: parseDataSource({
            ...get().dataSource,
            data: { ...get().dataSource.data, items: data },
          }),
        }),
    };
  });
  return store;
}

export type ReportStore = ReturnType<typeof createReportStore>;
export const ReportStoreContext = createContext<ReportStore | null>(null);
export function useReportStoreApi() {
  const store = useContext(ReportStoreContext);
  if (!store)
    throw new Error(
      "Report designer components require a ReportStoreContext provider",
    );
  return store;
}
export function useReportStore<T = ReportState>(
  selector: (state: ReportState) => T = (state) => state as unknown as T,
): T {
  return useStore(useReportStoreApi(), selector);
}
