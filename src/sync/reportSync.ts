import type { ReportDefinition } from '../types/report';
import type { ReportDataSource } from '../types/datasource';
import type { ReportDocument } from '../types/document';
import { parseDataSource } from '../data/schema';
import { parseReport } from '../report/schema';

export interface SyncStatus {
  mcpConnecting: boolean;
  isSaving: boolean;
  mcpSynced: boolean;
  error: string | null;
  conflict: boolean;
}

export const initialSyncStatus: SyncStatus = {
  mcpConnecting: false, isSaving: false, mcpSynced: false, error: null, conflict: false,
};

// One request at a time. Dirty local edits are never replaced by a background poll.
export function createReportSync(options: {
  endpoint?: string;
  getDataSource?: () => ReportDataSource;
  setDocument?: (document: ReportDocument) => void;
  getReport: () => ReportDefinition;
  setReport: (report: ReportDefinition) => void;
  onStatus: (status: SyncStatus) => void;
  fetch: typeof fetch;
}) {
  let baseline = options.getReport();
  let baselineSource = options.getDataSource?.();
  const dirty = () => options.getReport() !== baseline || options.getDataSource?.() !== baselineSource;
  let version: string | undefined;
  let inFlight = false;
  let disposed = false;
  let status = { ...initialSyncStatus };
  const controller = new AbortController();
  const publish = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    if (!disposed) options.onStatus(status);
  };
  return {
    isDirty: dirty,
    async sync(forceReload = false) {
      if (disposed || inFlight || (status.conflict && !forceReload)) return;
      inFlight = true;
      publish({ mcpConnecting: true, mcpSynced: false });
      try {
        if (version === undefined || forceReload || !dirty()) {
          const response = await options.fetch(options.endpoint ?? '/api/report-layout', { signal: controller.signal });
          // Static hosting has no sync endpoint. Local editing must still work.
          if (response.status === 404 || (response.ok && !response.headers.get('content-type')?.includes('application/json'))) {
            publish({ error: null });
            return;
          }
          if (!response.ok) throw new Error(`Sync failed (${response.status})`);
          const remote = await response.json();
          const report = parseReport(remote.report);
          if (typeof remote.version !== 'string') throw new Error('Invalid report version');
          if (disposed) return;
          const locallyDirty = dirty();
          const source = remote.dataSource === undefined ? options.getDataSource?.() : parseDataSource(remote.dataSource);
          if (forceReload || !locallyDirty) {
            if (version !== remote.version || forceReload) {
              if (options.setDocument && source) options.setDocument({ formatVersion: 1, report, dataSource: source });
              else options.setReport(report);
            }
            baseline = options.getReport();
            baselineSource = options.getDataSource?.();
            publish({ conflict: false, error: null });
          }
          // Do not acknowledge a newer remote version while a local edit was in flight.
          if (locallyDirty && !forceReload && version !== undefined && version !== remote.version) {
            publish({ conflict: true, error: 'Report changed on disk. Reload to resolve the conflict.' });
            return;
          }
          version = remote.version;
        }
        const report = options.getReport();
        const dataSource = options.getDataSource?.();
        if (dirty()) {
          publish({ isSaving: true });
          const response = await options.fetch(options.endpoint ?? '/api/report-layout', {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'If-Match': version! },
            body: JSON.stringify(dataSource ? { formatVersion: 1, report, dataSource } : report),
          });
          if (disposed) return;
          if (response.status === 409) {
            publish({ conflict: true, error: 'Report changed on disk. Reload to resolve the conflict.' });
            return;
          }
          if (!response.ok) {
            const detail = await response.json().catch(() => null);
            throw new Error(detail?.error ?? `Save failed (${response.status})`);
          }
          const saved = await response.json();
          if (typeof saved.version !== 'string') throw new Error('Invalid saved report version');
          version = saved.version;
          baselineSource = dataSource;
          baseline = report; // Newer edits remain dirty and will be saved on the next tick.
        }
        publish({ mcpSynced: true, error: null });
      } catch (error) {
        if (!disposed) publish({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        inFlight = false;
        publish({ mcpConnecting: false, isSaving: false });
      }
    },
    dispose() { disposed = true; controller.abort(); },
  };
}
