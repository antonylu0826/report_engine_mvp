# TypeScript 輕量級 XtraReport 報表引擎 (MVP)

以 **`@react-pdf/renderer`** 為底層向量排版與輸出引擎，打造一套具備 **像素級帶狀模型（Pixel-Level Banded Architecture）**、**可視化設計器（Designer）** 與 **即時向量 PDF 預覽器（Viewer）** 的 Web 原生現代企業級報表系統。

風格全面採用 **shadcn/ui** 現代簡潔灰階調色，內建本地完整繁體中文字型支援（Noto Sans TC），並提供專屬 **AI Agent 像素級 MCP 伺服器**。

---

## 📸 介面展示 (Screenshots)

### 1. 可視化設計器 (Visual Designer)
採用正統 Band 帶狀標題條（Band Strip）架構，控制項座標嚴格隔離，支援滑鼠拖曳定位、Band 高度拉伸、以及右側即時屬性檢查器（Property Grid）。

![可視化設計器](.assets/designer_preview.png)

---

### 2. 即時 PDF 向量預覽器 (PDF Live Preview)
直接於瀏覽器內無伺服器（Serverless）即時算繪企業級高水準出貨單：
- 完整包含**多欄客戶資訊卡**（左側統編、地址、聯絡人；右側單號、採購單、月結條件）。
- **精密封閉表格**：垂直貫穿格線、灰底粗框表頭、明細列資料自動對齊。
- **會計結算卡**：交易注意事項、中文大寫金額（`新臺幣陸拾肆萬伍仟柒佰伍拾元整`）、未稅小計、5% 營業稅與雙底線含稅總計。
- **四格核決印章矩陣**：製單人員、業務主管、倉管點收、客戶簽收蓋章。
- 支援多頁跨頁、表頭自動重複（PageHeader）、動態原生頁碼（`第 1 頁，共 2 頁`）以及全表統計總計（`=SUM(amount)`）。

![即時 PDF 預覽](.assets/pdf_preview.png)

---

### 3. Agent 協作模式 (Pixel-Level Agent Copilot)
專為 AI Agent 設計的像素級 Banded IR 模型。不同於過度簡化死板的 Template 封裝，系統賦予 Agent 完整控制像素座標（`x`, `y`, `width`, `height`）、邊框粗細與文字對齊的能力，讓 Agent 能排版出 100% 貼近真實人類 ERP / 會計日常使用的複雜企業單據。

![Agent 協作模式](.assets/agent_preview.png)

---

### 4. 宣告式 JSON Schema 檢視與即時編輯 (Schema Editor)
整份報表採用純 JSON 宣告式結構定義，可雙向編輯並立即套用回設計器，極易持久化儲存於後端資料庫或進行版本控制。

![JSON Schema 檢視](.assets/schema_preview.png)

---

## ✨ 核心特色 (Key Features)

- **正統像素級帶狀架構 (Pixel-Level Banded Architecture)**：
  - `ReportHeader`：報表首頁封面、公司抬頭、左右客戶與單據卡片（僅第一頁出現一次）。
  - `PageHeader`：每頁固定重複的表格標題列（跨頁自動重複）。
  - `Detail`：依傳入之資料集逐筆展開資料列範本，具備垂直格線貫穿。
  - `ReportFooter`：全表會計結算（大寫金額、稅額、雙底線總計）與企業四格簽核矩陣（僅最末頁出現一次）。
  - `PageFooter`：固定於每頁底部的頁尾、列印資訊與動態頁碼。
- **真實企業出貨單設計標準**：
  - 徹底告別過度簡化的玩具樣式，涵蓋真實商務必備之統編、交貨地址、匯款帳號、法律備註、中文大寫金額與核決印章格。
- **AI Agent 原生像素級 MCP 工具組 (Agent-Native MCP Server)**：
  - 支援 Model Context Protocol (MCP) 標準，提供 8 個精準原子工具（`get_report_layout`、`add_control`、`update_control`、`set_band_controls`、`export_pdf` 等），Agent 可直接精準操縱任何座標與樣式。
- **純前端直出 PDF (Client-side Rendering)**：
  - 採用 `@react-pdf/renderer`，無需常駐 Node.js / Puppeteer 伺服器，大幅降低伺服器負載與維運成本。
- **中文字型零亂碼支援**：
  - 內建標準繁體中文字型（Noto Sans TC），徹底解決 PDF 中文亂碼與問號問題。
- **運算式與格式化引擎**：
  - 支援合計運算 `=SUM(field)`、資料列序號 `=ROW_INDEX`。
  - 支援貨幣格式化（`C0`、`C2`）、千分位數值（`N0`）、日期格式化。
- **多頁與長表驗證**：
  - 內建 14 筆（單頁）、45 筆（2頁跨頁）、100 筆（4~5頁大表）快速切換測試。

---

## 🛠️ 技術選型 (Tech Stack)

| 模組 | 選型 | 說明 |
| :--- | :--- | :--- |
| **底層 PDF 引擎** | `@react-pdf/renderer` | 提供 PDF 向量繪製、Flexbox 自動流式排版、分頁斷頁能力 |
| **前端框架** | `React 19` + `TypeScript` + `Vite 8` | 極速模組熱重載 (HMR) 與型別安全 |
| **UI 設計系統** | `shadcn/ui` + `Tailwind CSS v4` | 現代簡約的灰階質感介面與圖示庫（`lucide-react`） |
| **狀態管理** | `zustand` | 輕量、反應迅速的像素級報表定義與畫布狀態管理 |
| **Agent 協作協定** | `@modelcontextprotocol/sdk` | 支援 Stdio 傳輸之標準 MCP Server |

---

## 🚀 快速開始 (Getting Started)

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動本機開發伺服器

```bash
npm run dev
```

開啟瀏覽器前往 [http://localhost:5173/](http://localhost:5173/) 即可開始體驗！

### 3. 啟動 MCP 伺服器 (供 Claude Desktop / Cursor / Antigravity 調用)

```bash
npm run mcp
```

### 4. 建置生產版本

```bash
npm run build
```

---

## 🤖 AI Agent 整合：MCP 伺服器 (Model Context Protocol)

本專案內建標準的 **MCP 伺服器**，任何支援 MCP 的 AI Agent（如 Claude Desktop、Cursor、Antigravity Agent、Cline 等）皆可直接透過工具調用（Tool Calling）精準操控整份報表！

### 1. 提供的 8 大像素級 MCP 工具

| MCP 工具名稱 | 說明 |
| :--- | :--- |
| `get_report_layout` | 讀取當前整份報表規格（包含 A4 可繪寬度 515.28pt、所有 Bands 與控制項精確座標） |
| `add_control` | 在指定 Band 新增精確座標的控制項（`Label`、`Field`、`Expression`、`Line`、`Image`） |
| `update_control` | 修改特定控制項之座標 (x, y)、尺寸 (width, height)、文字內容或樣式屬性 |
| `delete_control` | 從指定 Band 中刪除特定控制項 |
| `set_band_height` | 調整指定 Band 的物理高度（pt） |
| `set_band_controls` | 批次置換某個 Band 的全部控制項（適合 Agent 一次排好客戶資訊卡或簽核矩陣） |
| `set_full_report` | 直接替換整份 ReportDefinition（適合 Agent 一次性產生整張新單據） |
| `inspect_and_preview_layout` | 【Agent 排版感知核心】秒級幾何健檢與視覺快照。自動偵測溢出破版、文字碰撞、表格欄位垂直對齊度，並同步輸出 SVG 向量圖與實體 PDF 檔案 |
| `export_pdf` | 使用當前像素架構直接算繪高解析 PDF 輸出至本機磁碟供檢驗 |

### 2. Client 端設定範例 (例如 Cursor / Claude Desktop `mcp_config.json`)

```json
{
  "mcpServers": {
    "report-engine": {
      "command": "npx",
      "args": ["-y", "tsx", "d:/Source/Private/report_engine_mvp/src/mcp/index.ts"]
    }
  }
}
```
