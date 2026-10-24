import { useReportStore } from '@/store/useReportStore';
import { childSchema } from '@/report/dataSchema';

export function useFormulaData() {
  const state = useReportStore();
  const report = state.getActiveReport();
  const path = state.editingSubReportPath;
  const parent = path ? state.report.bands.find(b => b.id === path.bandId)?.controls.find(c => c.id === path.controlId) : undefined;
  return { state, report, schema: parent ? childSchema(parent, state.dataSource.schema)! : state.dataSource.schema,
    data: state.getActiveData(), parameters: state.dataSource.data.parameters };
}
