# 嵌入與套件契約（0.2.0）

這一版提供一個 ESM 套件 `@report-engine/report-engine`，以 subpath 分開核心、React 設計器、Node PDF 與 MCP adapter。原始專案保留為獨立示範應用，沒有 Haneinfo 整合。

## 建置及安裝

```sh
npm ci
npm run build:package
npm pack ./packages/report-engine
# 在宿主專案安裝產生的 tgz，以及 React 19 / react-dom 19。
```

`npm run test:package` 會真的打包、在系統暫存目錄安裝到另一個專案，測試公開匯入、NodeNext declarations、SSR、獨立設計器狀態、內附中文字型及真正 MCP client。它不發布套件；安裝階段需要 npm registry 連線。

| 入口 | 環境／責任 |
| --- | --- |
| `@report-engine/report-engine` 或 `/core` | 報表／資料結構、驗證、公式與幾何；不匯入 React 或 Node I/O |
| `/designer` | React 19 元件、實例 store、PDF client |
| `/styles.css` | 設計器 Tailwind stylesheet，宿主明確匯入；含基礎樣式及主題變數 |
| `/pdf` | Node `renderReportPdf`、`PDFCompilerProps`、`handleReportApi` |
| `/mcp` | 不自動連線的 `createReportMcpServer`、工具目錄、檔案 repository |

Node 端字型從套件內的 `dist/assets/NotoSansTC.ttf` 解析，與工作目錄無關；OFL 授權一併附入。PDF 與 MCP 入口供 Node 使用，前端只引用 core／designer。

## 完整文件

```ts
import type { ReportDocument } from '@report-engine/report-engine';
const document: ReportDocument = {
  formatVersion: 1,
  report,     // ReportDefinition
  dataSource // { id, name, schema: { parameters?, detailFields }, data: { parameters?, items } }
};
```

可直接載入 `examples/custom-invoice.json`：兩筆自訂訂單、主檔客戶參數、row 金額及 report 總計，預期總額為 49。範本與資料來源一起持久化，以免重新啟動後仍套用舊示範 schema。舊的單純 ReportDefinition 檔案可讀取；第一次成功儲存才升級 envelope，讀取不改寫檔案。

`parseReportDocument` 檢查結構、JSON 資料型別、必填值與 schema；`validateReportDocument` 加上公式的靜態驗證。`preflightDocument(document)` 統一檢查實際資料、公式、條件、幾何及分頁，回傳 errors／warnings 與可定位的 diagnostics；PDF 使用相同預檢。這些動作不會修改輸入資料。詳見 [條件式列印與健檢](conditional-printing.md)。

## React 元件

```tsx
import { useRef } from 'react';
import { ReportDesigner, type ReportDesignerHandle } from '@report-engine/report-engine/designer';
import '@report-engine/report-engine/styles.css';

function Editor({ document }) {
  const ref = useRef<ReportDesignerHandle>(null);
  return <div style={{ height: 700 }}>
    <ReportDesigner
      ref={ref}
      initialDocument={document}
      pdfEndpoint="/api/report-pdf"
      onChange={next => console.log(next)}
    />
  </div>;
}
```

`initialDocument` 僅於 mount 初始化。宿主後續載入其他文件時，呼叫 `ref.current.setDocument(document)`；這會檢查結構並清除該實例歷史。宿主可以先呼叫 core 的 `validateReportDocument` 做完整靜態驗證。

每個 mount 有各自的文件、選取、復原／重做、剪貼簿及 PDF 快取。快捷鍵只在該元件接到鍵盤事件時生效；文字輸入框保留原生編輯操作。語言偏好目前仍是應用程式共用設定；同頁兩個設計器切換語言會一起切換。stylesheet 需要由宿主評估與既有全域樣式的搭配。

ref 提供 `getDocument()`（複本）、`setDocument()`、`undo()`、`redo()`。`onChange` 於文件或資料更新時通知，不含選取／zoom；拖曳期間也會觸發，由宿主決定防抖及儲存策略。設計器編輯途中允許暫時無效的公式，儲存／匯出前仍須驗證。

宿主也可以提供 `renderPdf(report, rows, dataSource, refresh?) => Promise<Blob>`；它優先於 `pdfEndpoint`。這樣可接現有 API／認證。預覽與匯出會透過同一個 callback；使用內建 `createPdfClient` 時，同一快照共用同一份 PDF 位元組。

預設不連 `/api/report-layout`，不載入示範資料。需要本機風格同步時，明確傳 `syncEndpoint`。資料查詢、登入、授權、遠端 repository、儲存歷史及多人合併仍由宿主負責。

## 同步 HTTP 契約

- GET `syncEndpoint`：`{ formatVersion: 1, report, dataSource, version, mtime, legacy }`。
- POST `syncEndpoint`：body 為 ReportDocument，header `If-Match: version`；成功 `{ success: true, version, mtime }`。
- 409：版本衝突，設計器保留本機內容，等待明確重新載入。
- 400／422：結構／公式驗證失敗，既有文件不變。

版本涵蓋範本與資料。資料單獨修改、慢速讀取／儲存期間的新編輯也會保留 dirty 狀態。本機檔案 repository 使用暫存檔 rename 與 optimistic version，並非資料庫的跨程序交易或多人協作服務。

## Node PDF 與 HTTP

```ts
import { renderReportPdf } from '@report-engine/report-engine/pdf';
const bytes = await renderReportPdf({
  report: document.report,
  dataSource: document.dataSource,
  timeZone: 'Asia/Taipei',
  executionTime: '2026-10-24T00:00:00Z'
});
```

`handleReportApi(req, res)` 可掛入 Node HTTP server；回傳 `false` 表示路由不由它處理。它提供 `/api/report-pdf`、`/api/formula-catalog`、`/api/validate-report-formulas`、`/api/preflight-report`，不包含文件儲存及認證。API 限制請求 20 MiB、明細 10,000 筆。正式服務請由宿主提供其授權及資源管理。

## MCP adapter

```ts
import { createReportMcpServer, createDocumentRepository } from '@report-engine/report-engine/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const repository = createDocumentRepository('/absolute/path/report.json', document);
repository.initialize();
const server = createReportMcpServer({
  repository,
  initialDocument: document,
  outputDirectory: '/absolute/path/exports'
});
await server.connect(new StdioServerTransport());
```

單純 import adapter 不會開啟 stdio 或初始化檔案。repository 可換成實作 `ReportDocumentRepository` 的同步或非同步宿主儲存；write 必須依 expectedVersion 拒絕過期寫入，成功回傳含新 version 的 snapshot。

Agent 建議流程：`get_report_data_source` → `get_available_data_fields`／`get_formula_catalog` → `preview_report_changes` → `apply_report_changes` → `export_pdf`。預檢不寫檔，套用需帶 baseVersion；所有工具都有統一 structuredContent。操作與相容性見 [MCP 變更契約](mcp-changes.md)。

`set_report_data_source({ dataSource, report? })` 會一起驗證新資料與範本；切換 schema 時可連同相容範本原子提交。所有後續工具使用已儲存的資料，沒有示範資料 fallback。`export_pdf.recordCount` 現在是已儲存資料的筆數上限，省略時輸出全部資料，不再產生假資料。`reset_report_layout` 明確還原 initialDocument 的範本及資料。

## 範例與測試

```sh
npm run build:package
npm run dev
# http://localhost:5173/examples/embedded.html
```

此頁使用建置後的 designer，放入兩個 650px 高的實例；修改左側標題、複製／復原左側控制項時，右側文件與 onChange 計數維持不變。更改 package 程式後需先重新執行 build:package。

完整驗證執行 `npm run check`；PDF 分頁規則及視覺基準更新見 `docs/pdf-pagination.md`，使用者檢視順序見 `docs/review-guide.md`。
