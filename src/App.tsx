import { EditorToolbar } from './designer/EditorToolbar';
import { lazy, Suspense } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Navbar } from '@/components/designer/Navbar';
import { Toolbox } from '@/components/designer/Toolbox';
import { BandCanvas } from '@/components/designer/BandCanvas';
import { PropertyPanel } from '@/components/designer/PropertyPanel';

const ReportPreflightPanel = lazy(() => import('./components/diagnostics/ReportPreflightPanel').then(module=>({default:module.ReportPreflightPanel})));
const DataSourceEditor = lazy(() => import('./components/data/DataSourceEditor').then(module => ({ default: module.DataSourceEditor })));
const ReportViewer = lazy(() => import('@/components/viewer/ReportViewer').then(module => ({ default: module.ReportViewer })));
const SchemaViewer = lazy(() => import('@/components/schema/SchemaViewer').then(module => ({ default: module.SchemaViewer })));
const AgentCopilot = lazy(() => import('@/components/agent/AgentCopilot').then(module => ({ default: module.AgentCopilot })));
const CalculatedFieldsPanel = lazy(() => import('@/components/formula/CalculatedFieldsPanel').then(module => ({ default: module.CalculatedFieldsPanel })));

export function DesignerView() {
  const activeTab = useReportStore(state => state.activeTab);

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-50 text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-50">
      <Navbar />
      <EditorToolbar />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <Suspense fallback={<div role="status" className="flex-1 grid place-items-center text-sm text-slate-500">Loading…</div>}>
          {activeTab === 'designer' && (
            <>
              <Toolbox />
              <BandCanvas />
              <PropertyPanel />
            </>
          )}

          {activeTab === 'preview' && <ReportViewer />}

          {activeTab === 'agent' && <AgentCopilot />}

          {activeTab === 'preflight' && <ReportPreflightPanel />}
          {activeTab === 'data' && <DataSourceEditor />}
          {activeTab === 'schema' && <SchemaViewer />}
          {activeTab === 'formulas' && <CalculatedFieldsPanel />}
        </Suspense>
      </div>
    </div>
  );
}

export default DesignerView;
