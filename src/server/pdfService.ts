import type { PDFCompilerProps } from '../types/render';
import type { Buffer } from 'node:buffer';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportPDFDocument } from '../compiler/pdfCompiler.tsx';

/** Host-neutral Node entry point, shared by HTTP and MCP. Preflight precedes rendering. */
export async function renderReportPdf(options: PDFCompilerProps): Promise<Buffer> {
  const document = ReportPDFDocument(options);
  return renderToBuffer(document);
}
