import { useReportStore } from '@/store/useReportStore';
import { Navbar } from '@/components/designer/Navbar';
import { Toolbox } from '@/components/designer/Toolbox';
import { BandCanvas } from '@/components/designer/BandCanvas';
import { PropertyPanel } from '@/components/designer/PropertyPanel';
import { ReportViewer } from '@/components/viewer/ReportViewer';
import { SchemaViewer } from '@/components/schema/SchemaViewer';
import { AgentCopilot } from '@/components/agent/AgentCopilot';

export function App() {
  const { activeTab } = useReportStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
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
      </div>
    </div>
  );
}

export default App;
