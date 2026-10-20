# TypeScript 版 XtraReport 輕量級報表系統 (MVP) 實作計畫

本專案旨在以 **`@react-pdf/renderer`** 作為底層排版與 PDF 輸出引擎，打造一套具備 **帶狀模型（Banded Model）**、**可視化設計器（Designer）** 與 **即時預覽器（Viewer）** 的 Web 原生 TypeScript 報表系統。

---

## 1. 核心設計概念 (Core Architecture)

傳統 XtraReport / Crystal Reports 的精髓在於 **帶狀結構（Bands）**。每一份報表由多個 Band 組成，資料驅動時透過遍歷資料集自動展開。

```mermaid
graph TD
    subgraph ReportDefinition [報表定義 Report Schema JSON]
        RH[ReportHeader: 報表首頁封面或大標題]
        PH[PageHeader: 每頁重複的頁首 / 表頭]
        GH[GroupHeader: 群組開頭，例如客戶別/部門別]
        DB[DetailBand: 資料列範本，逐筆渲染]
        GF[GroupFooter: 群組小計 / 統計]
        PF[PageFooter: 每頁頁尾 / 頁碼]
        RF[ReportFooter: 全表總計]
    end

    subgraph Compiler [核心直譯/編譯器 Compiler]
        Data[(JSON 資料集)] --> CompilerEngine
        ReportDefinition --> CompilerEngine
        CompilerEngine -->|解析資料、計算運算式、展開 Detail| ReactPDFTree[React-PDF JSX 元件樹]
    end

    subgraph Output [輸出端]
        ReactPDFTree --> Viewer[前端 PDFViewer 即時預覽]
        ReactPDFTree --> Export[PDF 下載 / 列印串流]
```

### 1.1 為什麼選擇 `@react-pdf/renderer`？
1. **天然的流式佈局（Flexbox）**：底層採用 Facebook Yoga，支援動態內容高度（CanGrow），內容增加時自動推擠後續元件。
2. **內建分頁與跨頁保護**：支援 `wrap={false}`（避免區塊被截斷跨頁）以及 `<Text render={({ pageNumber, totalPages }) => ...} />` 原生頁碼計算。
3. **純前端支援**：可直接在瀏覽器記憶體內產生 Blob PDF，無需常駐 Node.js / Chromium 伺服器，大幅降低維運成本。

---

## 2. MVP 技術選型 (Tech Stack)

| 模組 | 推薦選型 | 選擇理由 |
| :--- | :--- | :--- |
| **底層 PDF 引擎** | `@react-pdf/renderer` | 提供 PDF 向量、字型、Flexbox 分頁能力 |
| **可視化設計器框架** | `@craftjs/core` 或 `@dnd-kit` | 專門處理可巢狀、可拖曳的元件樹與屬性編輯器（Property Panel） |
| **核心狀態管理** | `zustand` | 輕量、反應快速，易於管理報表 Schema 與即時更新 |
| **運算式引擎** | 輕量自研或 `expr-eval` | 支援加總 `Sum(Amount)`、條件 `Iif(...)`、格式化等 |
| **開發框架** | `Vite` + `React` + `TypeScript` | 快速構建、模組化良好 |
| **UI 元件庫** | `shadcn/ui` + `lucide-react` | 現代化、簡潔直觀的工具列與屬性格線介面 |

---

## 3. 報表定義資料模型 (Report Schema Specification)

報表設計將以純 JSON 格式保存，便於儲存至資料庫與版本控制。

```typescript
// 報表總體結構
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

// 帶狀區塊定義
export type BandType =
  | 'ReportHeader'
  | 'PageHeader'
  | 'GroupHeader'
  | 'Detail'
  | 'GroupFooter'
  | 'PageFooter'
  | 'ReportFooter';

export interface BandDefinition {
  id: string;
  type: BandType;
  height: number;
  keepTogether?: boolean; // 避免此 Band 跨頁被切斷
  controls: ControlDefinition[];
}

// 控制項定義
export type ControlType = 'Label' | 'Field' | 'Expression' | 'Line' | 'Image';

export interface ControlDefinition {
  id: string;
  type: ControlType;
  x: number;
  y: number;
  width: number;
  height: number;
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
    color?: string;
    backgroundColor?: string;
    borderBottom?: string;
  };
  // 屬性設定
  text?: string;            // 用於 Label
  fieldName?: string;       // 用於 Field 資料繫結 (例如: "item.price")
  expression?: string;      // 用於運算式 (例如: "SUM(item.amount)")
  formatString?: string;    // 例如: "C2" (貨幣) 或 "yyyy-MM-dd"
}
```

---

## 4. MVP 開發階段劃分 (Milestones)

### Phase 1: 報表編譯直譯器（Compiler Engine）
> **目標**：驗證核心可行性——將 JSON Schema 搭配假資料，成功產生出正確的 `@react-pdf/renderer` 文件。

* [ ] 定義 TypeScript 型別（`ReportDefinition`、`BandDefinition`、`ControlDefinition`）。
* [ ] 實作直譯器核心函式：
  * **PageHeader / PageFooter 處理**：對應至 React-PDF `<Page fixed>`，固定在頁首與頁尾。
  * **DetailBand 展開迴圈**：遍歷傳入的陣列資料（`dataSource: any[]`），將每一筆資料映射為一個 `<View wrap={false}>` 區塊。
  * **基本格式化**：實作簡單的數值千分位與日期格式化。
* [ ] 設定中文字型載入（使用 Noto Sans TC / 思源黑體，避免 PDF 出現問號亂碼）。

### Phase 2: Banded 可視化設計器（Designer MVP）
> **目標**：打造視覺化操作畫布，使用者可以在各個 Band 內拖拉排版並配置屬性。

* [ ] **版面佈局**：
  * 左側：工具箱（Toolbox，可拖曳 Label、Field、Line、Table Cell 等）與欄位清單（Field List）。
  * 中間：畫布區（垂直分段顯示 PageHeader、DetailBand、PageFooter，支援輔助格線與尺規）。
  * 右側：屬性檢查器（Property Grid，調整座標、寬高、字級、色彩、繫結欄位）。
* [ ] **拖曳實作**：
  * 限制控制項拖曳時**只能留在特定的 Band 內部**，以 Band 頂端作為相對 Y 軸。
  * 支援 Band 垂直高度調整（拖拉 Band 下邊緣變高/變矮）。

### Phase 3: 資料繫結與運算式（Data Binding & Summary）
> **目標**：讓報表能吃外部 JSON 資料並正確呈現統計結果。

* [ ] 實作資料上下文（Data Context）注入機制。
* [ ] 實作基礎加總運算：
  * 在 `ReportFooter` 放置運算式控制項，支援如 `=SUM(items.subtotal)` 的合計功能。
  * 支援動態頁碼標籤：`第 [PageNumber] 頁，共 [TotalPages] 頁`。

### Phase 4: 即時預覽器（Viewer）與匯出整合
> **目標**：設計時隨時切換「設計（Design）」與「預覽（Preview）」分頁。

* [ ] 設計與預覽雙向切換 Tab：
  * 切換到預覽時，將當前設計器狀態的 JSON + 測試資料傳入直譯器，即時呈現 PDF 畫面。
* [ ] 匯出功能：一鍵下載 `.pdf`，或匯出報表範本 `.json` / 載入既有範本。

---

## 5. 潛在風險與解決對策 (Risks & Mitigations)

1. **中文缺字與字型體積問題**：
   * *問題*：PDF 若無嵌入中文字型會顯示亂碼，但中文字型檔往往動輒 10MB~20MB。
   * *對策*：提供輕量子集化字型，或使用 Google Fonts CDN 提供的 Noto Sans TC 輕量切片字型進行非同步載入。
2. **設計器座標（px）與 PDF 單位（pt）換算**：
   * *問題*：螢幕像素（CSS px）與 PDF 點（pt，1/72 英吋）在不同縮放比例下可能產生誤差。
   * *對策*：內部統一採用 `pt` 作為資料結構標準單位（A4 = 595.28 x 841.89 pt），設計器畫布透過 CSS `transform: scale()` 進行 DPI 縮放展示。
3. **跨頁裁切（Page Splitting）**：
   * *問題*：DetailBand 若高度過高，可能會被 PDF 引擎從中間橫切成兩半。
   * *對策*：為每個 Detail 項目外層加上 `wrap={false}`，強迫超出頁面時整筆移到下一頁。

---

## 6. 結論與下一步行動

以 `@react-pdf/renderer` 為核心打造 TypeScript 版 XtraReport 是**完全可行且具備高度商業價值**的技術路線。
在 MVP 階段，我們先避開複雜的「多層子報表（Subreports）」與「交叉表（CrossTab）」，聚焦於：
1. **精確的帶狀模型（PageHeader + Detail + PageFooter）**
2. **清晰的 JSON Schema**
3. **即時拖拉設計與 PDF 預覽**

準備就緒後，即可開始建立基礎專案結構與核心直譯器原型！
