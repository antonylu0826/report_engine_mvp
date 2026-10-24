import { ReportDesigner } from './designer/ReportDesigner';
import { sampleOrderReport, sampleOrderDataSource, sampleOrderData14, sampleOrderData45, sampleOrderData100 } from './mock/sampleReport';
const initialDocument = { formatVersion: 1 as const, report: sampleOrderReport, dataSource: sampleOrderDataSource };
const dataPresets = [sampleOrderData14, sampleOrderData45, sampleOrderData100].map(rows => ({ name: `${rows.length} rows`, sourceId: sampleOrderDataSource.id, schema: sampleOrderDataSource.schema, rows }));
export default function App() {
  return <div style={{ height: '100vh' }}><ReportDesigner initialDocument={initialDocument} syncEndpoint="/api/report-layout" dataPresets={dataPresets} /></div>;
}
