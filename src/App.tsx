import { lazy, Suspense } from 'react';
import { useReportStore } from '@/store/useReportStore';
import { Navbar } from '@/components/designer/Navbar';
import { Toolbox } from '@/components/designer/Toolbox';
import { BandCanvas } from '@/components/designer/BandCanvas';
import { PropertyPanel } from '@/components/designer/PropertyPanel';

const ReportViewer = lazy(() => import('@/components/viewer/ReportViewer').then(module => ({ default: module.ReportViewer })));
const SchemaViewer = lazy(() => import('@/components/schema/SchemaViewer').then(module => ({ default: module.SchemaViewer })));
const AgentCopilot = lazy(() => import('@/components/agent/AgentCopilot').then(module => ({ default: module.AgentCopilot })));

export function App() {
  const activeTab = useReportStore(state => state.activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
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

          {activeTab === 'schema' && <SchemaViewer />}
        </Suspense>
      </div>
    </div>
  );
}

export default App;
