import { useEffect, useRef, useState } from 'react';
import { useReportStore } from '../store/useReportStore';
import { createReportSync, initialSyncStatus } from './reportSync';

export function useReportSync() {
  const [status, setStatus] = useState(initialSyncStatus);
  const sessionRef = useRef<ReturnType<typeof createReportSync> | null>(null);
  useEffect(() => {
    const session = createReportSync({
      getReport: () => useReportStore.getState().report,
      setReport: report => useReportStore.getState().setReport(report),
      onStatus: setStatus,
      fetch: window.fetch.bind(window),
    });
    sessionRef.current = session;
    let saveTimer: ReturnType<typeof setTimeout>;
    const unsubscribe = useReportStore.subscribe((state, previous) => {
      if (state.report === previous.report) return;
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
  }, []);
  return { ...status, reload: () => sessionRef.current?.sync(true), isDirty: () => sessionRef.current?.isDirty() ?? false };
}
