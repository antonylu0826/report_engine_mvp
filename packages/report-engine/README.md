# Report Engine 0.2.0

ESM banded report core, React designer and Node PDF/MCP adapters. Each designer owns its document, selection, history and clipboard. Supply a complete `ReportDocument`; see [the included example](dist/examples/custom-invoice.json).

```tsx
import { ReportDesigner } from '@report-engine/report-engine/designer';
import '@report-engine/report-engine/styles.css';

<div style={{ height: 700 }}>
  <ReportDesigner initialDocument={document} pdfEndpoint="/api/report-pdf" onChange={save} />
</div>
```

The host provides persistence and authorization. `syncEndpoint` is opt-in; `renderPdf` can replace the HTTP client. `initialDocument` initializes on mount; a ref exposes `getDocument`, `setDocument`, `undo` and `redo`. Locale preference is currently shared by the application. The stylesheet includes Tailwind base styles.

```ts
import { validateReportDocument, preflightDocument } from '@report-engine/report-engine/core';
import { renderReportPdf } from '@report-engine/report-engine/pdf';
const checked = validateReportDocument(document);
const preflight = preflightDocument(checked);
if (!preflight.valid) throw new Error(JSON.stringify(preflight.diagnostics));
const bytes = await renderReportPdf({ report: checked.report, dataSource: checked.dataSource });
```

Core has no React or Node I/O dependency. `/pdf` and `/mcp` are Node entry points. PDF output includes Noto Sans TC and its OFL license. The MCP adapter creates no transport or files on import; connect `createReportMcpServer` to a transport with a supplied repository and initial document.

Bands and controls support conditional visibility; supported controls also merge ordered conditional styles using the same formula engine. The 22 MCP tools include read-only preflight/preview and version-checked apply, with a uniform structured outcome.

See [the embedding contract](dist/docs/embedding.md), [conditional printing](dist/docs/conditional-printing.md), [MCP changes](dist/docs/mcp-changes.md), and [pagination rules](dist/docs/pdf-pagination.md). The source repository contains the two-instance embedding demo and regression scripts. This is a preview package for review, not an npm release.
