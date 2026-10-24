import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Ref,
  type KeyboardEvent,
} from "react";
import { DesignerView } from "../App";
import { createReportStore, ReportStoreContext } from "../store/useReportStore";
import { DesignerServicesContext, type DesignerServices } from "./services";
import { createPdfClient } from "../client/reportPdf";
import type { ReportDocument } from "../types/document";

export interface ReportDesignerHandle {
  getDocument(): ReportDocument;
  setDocument(document: ReportDocument): void;
  undo(): void;
  redo(): void;
}
export interface ReportDesignerProps extends Partial<DesignerServices> {
  initialDocument: ReportDocument;
  pdfEndpoint?: string;
  onChange?: (document: ReportDocument) => void;
  ref?: Ref<ReportDesignerHandle>;
}
/** Each mount owns its state, history, clipboard, PDF cache and optional sync session. */
export function ReportDesigner({
  initialDocument,
  onChange,
  ref,
  renderPdf,
  pdfEndpoint,
  syncEndpoint,
  dataPresets,
}: ReportDesignerProps) {
  const [store] = useState(() => createReportStore(initialDocument));
  const services = useMemo(
    () => ({
      renderPdf: renderPdf ?? createPdfClient(pdfEndpoint),
      syncEndpoint,
      dataPresets,
    }),
    [renderPdf, pdfEndpoint, syncEndpoint, dataPresets],
  );
  useImperativeHandle(
    ref,
    () => ({
      getDocument: () => structuredClone(store.getState().getDocument()),
      setDocument: (value) => store.getState().setDocument(value, true),
      undo: () => store.getState().undo(),
      redo: () => store.getState().redo(),
    }),
    [store],
  );
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (
          state.report !== previous.report ||
          state.dataSource !== previous.dataSource
        )
          onChange?.(structuredClone(state.getDocument()));
      }),
    [store, onChange],
  );
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable="true"]'))
      return;
    const state = store.getState(),
      key = event.key.toLowerCase(),
      command = event.ctrlKey || event.metaKey;
    if (command && key === "z") {
      event.preventDefault();
      if (event.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if (command && key === "y") {
      event.preventDefault();
      state.redo();
      return;
    }
    if (state.activeTab !== "designer") return;
    if (command && ["a", "c", "v", "x", "d"].includes(key)) {
      event.preventDefault();
      if (key === "a") state.selectAll();
      if (key === "c" || key === "x" || key === "d") state.copySelection();
      if (key === "x") state.deleteSelection();
      if (key === "v" || key === "d") state.pasteSelection();
    } else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      state.deleteSelection();
    } else if (key === "escape") state.selectControl(null, null);
    else if (key.startsWith("arrow") && state.selectedControlIds.length) {
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      state.moveSelection(
        key === "arrowleft" ? -step : key === "arrowright" ? step : 0,
        key === "arrowup" ? -step : key === "arrowdown" ? step : 0,
      );
    }
  };
  return (
    <ReportStoreContext.Provider value={store}>
      <DesignerServicesContext.Provider value={services}>
        <div
          className="report-engine-designer"
          style={{ height: "100%", minHeight: 400 }}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <DesignerView />
        </div>
      </DesignerServicesContext.Provider>
    </ReportStoreContext.Provider>
  );
}
