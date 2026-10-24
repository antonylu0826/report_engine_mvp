import { useEffect, useRef, useState } from 'react';
import { useReportStoreApi } from '../store/useReportStore';
import { useDesignerServices } from '../designer/services';
import { createReportSync, initialSyncStatus } from './reportSync';

export function useReportSync() {
  const store = useReportStoreApi();
  const { syncEndpoint } = useDesignerServices();
  const [status, setStatus] = useState(initialSyncStatus);
  const sessionRef = useRef<ReturnType<typeof createReportSync> | null>(null);
  useEffect(() => {
    if (!syncEndpoint) return;
    const session = createReportSync({
      endpoint: syncEndpoint,
      getDataSource: () => store.getState().dataSource,
      setDocument: document => store.getState().setDocument(document, true),
      getReport: () => store.getState().report,
      setReport: report => store.getState().setReport(report),
      onStatus: setStatus,
      fetch: window.fetch.bind(window),
    });
    sessionRef.current = session;
    let saveTimer: ReturnType<typeof setTimeout>;
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.report === previous.report && state.dataSource === previous.dataSource) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void session.sync(), 500);
    });
    const initialTimer = setTimeout(() => void session.sync(), 0);
    const pollTimer = setInterval(() => void session.sync(), 1500);
    return () => {
      unsubscribe();
      clearTimeout(initialTimer);
      clearTimeout(saveTimer);
      clearInterval(pollTimer);
      session.dispose();
      sessionRef.current = null;
    };
  }, [store, syncEndpoint]);
  return { ...status, reload: () => sessionRef.current?.sync(true), isDirty: () => sessionRef.current?.isDirty() ?? false };
}
