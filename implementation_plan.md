# Report Engine MVP 實作狀態與後續計畫

更新日期：2026-10-24。

目前交付獨立的 TypeScript 報表元件 MVP，包含設計器、資料繫結與公式、Node PDF 編譯、預覽／下載，以及 MCP。Haneinfo 是未來可能的宿主，本輪沒有整合工作。

本文件記錄目前架構與交付狀態。需求訪談見 [公式引擎 v1 設計紀錄](docs/formula-engine-v1.md)，實際契約與操作方式見 [使用方式](docs/formula-engine-usage.md)，驗證與限制見 [CODE_REVIEW.md](CODE_REVIEW.md)。

## 目前架構

```mermaid
flowchart TD
    Host[宿主提供 schema、參數、JSON 明細] --> Validation
    Designer[設計器／Schema 編輯] --> Template[ReportDefinition]
    MCP[MCP：能力發現、驗證、試算、原子更新] --> Template
    Template --> Validation[共用結構、公式及作用域驗證]
    Registry[38 個內建函式的共用註冊表] --> Validation
    Registry --> Designer
    Registry --> MCP
    Validation --> Runtime[計算依賴、群組及子報表資料上下文]
    Runtime --> PDF[Node PDF 編譯與排版]
    PDF --> Output[PDF 位元組]
    Output --> Preview[瀏覽器預覽]
    Output --> Download[下載／列印]
```

範本使用 pt 座標及帶狀模型：ReportHeader、PageHeader、GroupHeader、Detail、GroupFooter、PageFooter、ReportFooter。主／子報表共用 Band 展開與驗證；一般控制項保留定位座標，分頁由 PDF 引擎處理。

宿主負責資料查詢、認證與授權；引擎接收資料並驗證、計算及輸出。前端以相同範本及資料快照共用後端 PDF，不在瀏覽器內另行編譯。

## 技術與責任分工

| 位置 | 責任 |
| --- | --- |
| src/types、src/report | TypeScript／Zod 報表結構、幾何、不可變更新、子報表資料 |
| src/formula | 受限語法樹、decimal.js 十進位值、Temporal 日期、函式註冊表、依賴與作用域 |
| src/compiler | 資料分組、Band 展開、格式化及 PDF 文件編譯 |
| src/controls | 設計器控制項與獨立的 PDF renderer registry |
| src/server | 版本化範本儲存、Vite 同步、Node／HTTP PDF 及公式 API |
| src/client、src/sync | PDF 請求快取、預覽／下載共用結果、範本同步與衝突保護 |
| src/components/formula | 計算欄位管理、公式輔助、診斷及試算 |
| src/mcp | 工具契約與 stdio adapter；公式目錄由共用註冊表提供 |
| tests、scripts | 核心、HTTP、PDF、同步競態、Vite preview、真正 MCP client 與 bundle 檢查 |

設計器使用 React、Zustand、HTML5 drag and drop 及既有畫布操作；目前沒有引入 Craft.js 或 dnd-kit。公式使用自己的受限語法，不使用 JavaScript eval、Function 或開發者自訂函式。

## 已完成的里程碑

| 項目 | 已交付內容 |
| --- | --- |
| 報表核心 | JSON 報表結構、中文字型、帶狀 PDF、單層分組、巢狀資料及頁碼 |
| 可視化設計器 | 多選拖曳／縮放、100 步復原／重做、複製貼上、對齊／等距、一層子畫布編輯 |
| 公式核心 | 38 個數值、邏輯、彙總、文字、日期及轉換函式；34 位十進位計算 |
| 計算欄位 | row／group／report、命名引用、依賴排序、循環與型別診斷；不修改輸入資料 |
| Agent 能力 | 22 個 MCP 工具，包含公式發現、預檢／差異預覽、版本化原子套用及統一結果 |
| 編輯輔助 | 欄位／函式插入、簽章與範例、即時錯誤定位、原始值與格式化結果 |
| 預覽與匯出 | 同一份後端 PDF；錯誤阻止輸出，輸入變更時撤下舊預覽 |
| 本機儲存 | 版本化 ReportDocument，範本與自訂資料來源原子儲存；暫存檔換名、版本雜湊及同步衝突保護 |
| 套件與嵌入 | 0.2.0 ESM 的 core／designer／pdf／mcp 入口、型別宣告、內附字型、每實例獨立狀態 |
| 長內容 | canGrow、多行表格、子表頭續頁、固定列完整換頁、過高區塊預先拒絕 |
| 列印規則 | 共用預檢與定位、條件式顯示／樣式、固定區段 keepTogether／逐列拆分 |
| 品質與體積 | 完整 check、56 項核心測試、54 頁 PDF 視覺回歸、獨立 consumer、MCP、5 個 Chromium 流程與 CI 設定、500 kB chunk／650 kB 首頁預算 |

新增範例已將主檔資訊與明細金額 → 小計 → 稅額 → 總計資料化；不自動覆寫使用者已儲存的範本。舊範本沒有 calculatedFields 時仍可載入，有意改變的空值及公式錯誤行為記錄於遷移說明。

## 執行與驗證

```sh
npm install
npx playwright install --with-deps chromium
npm run dev
npm run check
npm run build
npm run preview
```

- dev／preview：前端、PDF／公式 API、本機範本同步。
- npm run mcp：外部 Agent 使用的 stdio server，讀取已儲存資料契約；首次建立才使用示範文件。
- npm run server：獨立 Node PDF／公式 API，預設 127.0.0.1:3001；不提供前端或範本儲存。
- 純靜態前端：由宿主或反向代理提供同一來源的 API 路由，並自行處理範本儲存。

目前驗證環境為 Node v26.12.1／npm 11.20.0。正式建置首頁 JS 620.50 kB、最大 chunk 242.30 kB，均為未壓縮大小。瀏覽器自動測試已驗證條件套用、PDF 內容、定位、拖曳復原、MCP 同步／版本衝突及雙實例隔離。GitHub Actions 由推送觸發，遠端執行結果以 Actions 為準。完整驗證方式見 [testing.md](docs/testing.md)。

## 後續候選工作

本輪已完成自訂資料來源、套件嵌入、PDF 長內容、設計器操作，以及預檢、條件列印、MCP 版本化變更與瀏覽器／CI 設定。下一步等使用者檢視後再決定，候選方向為：

1. 正式儲存服務、跨程序交易、歷史版本與多人協作；認證／授權由宿主負責。
2. 補齊 i18n、宿主樣式隔離、可觀測錯誤及無障礙細節。
3. 擴充更多幾何、不同字型與多層子報表的分頁案例；SVG 保持版面概覽用途。
4. 有實際需求後評估自訂函式、交叉表、Excel／Word 及即時模型連線。

目前沒有 Haneinfo 整合，也沒有獨立草稿／發布生命週期。AgentCopilot 是操作示範，外部 Agent 透過 MCP 使用實際能力。檢視指引、API 與分頁規則分別見 docs/review-guide.md、docs/embedding.md 及 docs/pdf-pagination.md。
