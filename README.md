# TypeScript 輕量級 XtraReport 報表引擎 (MVP)

以 **`@react-pdf/renderer`** 為底層向量排版與輸出引擎，打造一套具備 **帶狀模型（Banded Model）**、**可視化設計器（Designer）** 與 **即時預覽器（Viewer）** 的 Web 原生現代報表系統。

風格全面採用 **shadcn/ui** 現代簡潔灰階調色，並內建高相容繁體中文字型支援。

---

## 📸 介面展示 (Screenshots)

### 1. 可視化設計器 (Visual Designer)
採用正統 Band 帶狀標題條（Band Strip）架構，控制項座標嚴格隔離，支援滑鼠拖曳定位、Band 高度拉伸、以及右側即時屬性檢查器（Property Grid）。

![可視化設計器](.assets/designer_preview.png)

---

### 2. Agent 協作模式 (Agent Copilot & Semantic Spec DSL)
專為 AI Agent 設計的雙層架構。Agent 透過僅 25 行的高階語意規格（無像素座標）或原子操作工具（`addColumn`、`setTheme`）即可精確操控報表，幾何編譯器自動計算物理寬度與垂直對齊，徹底根除 AI 心算座標破版問題。

![Agent 協作模式](.assets/agent_preview.png)

---

### 3. 即時 PDF 向量預覽器 (PDF Live Preview)
直接於瀏覽器內無伺服器（Serverless）即時算繪高品質向量 PDF。支援多頁跨頁、表頭自動重複（PageHeader）、動態原生頁碼（`第 1 頁，共 2 頁`）以及全表統計總計（`=SUM(amount)`）。

![即時 PDF 預覽](.assets/pdf_preview.png)

---

### 4. 宣告式 JSON Schema 檢視與即時編輯 (Schema Editor)
整份報表採用純 JSON 宣告式結構定義，可雙向編輯並立即套用回設計器，極易持久化儲存於後端資料庫或進行版本控制。

![JSON Schema 檢視](.assets/schema_preview.png)

---

## ✨ 核心特色 (Key Features)

- **AI Agent 原生雙層架構 (Agent-Native Architecture)**：
  - **高階語意層 (High-Level Semantic Spec)**：Agent 僅需處理 20~30 行純邏輯 DSL（無像素心算），支援欄位權重比例 (`widthWeight`)、全域主題切換、宣告式合計。
  - **幾何編譯層 (Coordinate Compiler)**：自動計算 A4 可列印寬度，自動將欄位對齊至小數點級別，徹底根除 AI 設計報表時的空間心算破版與上下欄位對不齊的難題。
  - **原子操作工具庫 (Mutation Tools)**：提供 `addColumn`、`removeColumn`、`setTheme` 等原子工具，方便 Agent 透過 Function Calling 或 MCP 進行精確增量微調。
- **經典帶狀架構 (Banded Report Architecture)**：
  - `ReportHeader`：報表首頁封面/大標題（僅第一頁出現一次）。
  - `PageHeader`：每頁固定重複的表格標題列（跨頁自動重複）。
  - `Detail`：依傳入之資料集逐筆展開資料列範本。
  - `ReportFooter`：全表統計匯總與簽核區塊（僅最末頁出現一次）。
  - `PageFooter`：固定於每頁底部的頁尾與動態頁碼。
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
| **狀態管理** | `zustand` | 輕量、反應迅速的報表定義與畫布狀態管理 |

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

### 3. 建置生產版本

```bash
npm run build
```

### 3. 啟動 MCP 伺服器 (供 Claude Desktop / Cursor / AI Agent 調用)

```bash
npm run mcp
```

---

## 🤖 AI Agent 整合：MCP 伺服器 (Model Context Protocol)

本專案內建標準的 **MCP 伺服器**，任何支援 MCP 的 AI Agent（如 Claude Desktop、Cursor、Antigravity Agent、Cline 等）皆可直接透過工具調用（Tool Calling）操控本系統！

### 1. 提供的 MCP 工具清單

| MCP 工具名稱 | 說明 |
| :--- | :--- |
| `get_report_spec` | 讀取當前報表高階語意規格（僅 20~30 行乾淨 DSL） |
| `set_report_theme` | 一鍵切換報表主題色系（`slate` / `blue` / `emerald` / `purple` / `amber`） |
| `set_report_title` | 變更公司主標題與單據副標題 |
| `add_report_column` | 新增資料欄位（自動重新平衡欄寬並確保上下對齊） |
| `remove_report_column` | 刪除指定欄位 |
| `update_report_column` | 微調欄位屬性（寬度權重、對齊方式、格式化、加總統計） |
| `compile_and_export_pdf` | 將語意規格透過幾何編譯器直接產出高品質 PDF 檔案至本機磁碟 |

### 2. Client 端設定範例 (例如 Claude Desktop / Cursor `mcp_config.json`)

```json
{
  "mcpServers": {
    "report-engine": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "d:/Source/Private/report_engine_mvp/src/mcp/index.ts"
      ]
    }
  }
}
```

設定完成後，您即可直接向 AI 對話：
> *「請用 report-engine 工具幫我把報表換成深藍色主題，並在品號後加上規格說明欄位，最後匯出成 output.pdf」*
> AI Agent 將會自動呼叫工具完成所有設計排版與 PDF 產出！

---

## 📋 報表結構定義 (Report Schema)

報表以乾淨的 JSON Schema 結構保存：

```typescript
export interface ReportDefinition {
  id: string;
  name: string;
  pageSettings: {
    size: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number }; // 單位: pt
  };
  bands: BandDefinition[];
}
```

---

## 📄 授權條款 (License)

MIT License
