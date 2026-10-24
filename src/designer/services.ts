import type { DataSourceSchema } from "../types/datasource";
import { createContext, useContext } from "react";
import { requestReportPdf, type PdfRequest } from "../client/reportPdf";
export interface DesignerServices {
  renderPdf: PdfRequest;
  syncEndpoint?: string;
  dataPresets?: {
    name: string;
    sourceId?: string;
    schema?: DataSourceSchema;
    rows: Record<string, unknown>[];
  }[];
}
export const DesignerServicesContext = createContext<DesignerServices>({
  renderPdf: requestReportPdf,
});
export const useDesignerServices = () => useContext(DesignerServicesContext);
