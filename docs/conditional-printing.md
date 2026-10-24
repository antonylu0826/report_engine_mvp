# 條件式列印與列印健檢（0.2.0）

Band 與控制項可設定 `visibleWhen`；控制項另有有序的 `styleRules`。兩者沿用公式引擎的 38 個函式、schema、計算欄位、作用域、固定執行時間及時區，不執行 JavaScript。

```json
{
  "visibleWhen": "=quantity > 0",
  "styleRules": [
    { "when": "=calc.amount < 0", "style": { "color": "#dc2626" } },
    { "when": "=calc.amount < -100", "style": { "fontWeight": "bold" } }
  ]
}
```

上例是合併到文字控制項的設定。完整文件見 [conditional-invoice.json](../examples/conditional-invoice.json)：正數與負數各一筆，零數量的明細隱藏，總計為 20。

## 執行規則

- 條件必須回傳 boolean 或 null；null 表示隱藏／不符合。省略 `visibleWhen` 表示顯示。數字與字串不會轉成 boolean。
- 顯示條件先執行，隱藏的 Band 不產生版面空間；隱藏控制項不輸出內容，但 Band 的基本高度仍保留。
- 隱藏內容不執行其內容公式、樣式條件或子報表。語法、名稱、型別及幾何仍會靜態檢查所有分支。
- 樣式規則從前往後合併至原有 style；多個符合規則的同名屬性由後者優先。每個控制項最多 32 條。
- 隱藏只是呈現設定；不會過濾資料或改變 SUM／COUNT。命名計算欄位仍依既有規則對原始資料求值，因此要用 IF 等語法處理計算本身的除以零。
- Detail 使用目前資料列，GroupHeader／GroupFooter 使用目前群組，其他 Band 使用全表作用域。子報表使用自己的資料與計算欄位。
- 頁首、頁尾的條件使用全表作用域。預檢幾何保守地計入宣告的固定區域；實際 PDF 僅為顯示的頁首／頁尾預留空間。

| 控制項 | 可條件設定的樣式 |
| --- | --- |
| Label、Field、Expression | color、backgroundColor、fontWeight、textAlign、borderColor |
| Line、CheckBox | color |
| Panel、SubReport | backgroundColor、borderColor |
| Image、Barcode、QRCode | 支援顯示條件，沒有條件樣式 |

條件樣式不改變座標、字級或控制項高度。邊框顏色需搭配原有非零邊框寬度才會顯示。

## 設計器

選取控制項或 Band，在右側「條件式列印」編輯顯示條件；文字等支援樣式的控制項可新增樣式規則，以 JSON 輸入樣式。按「套用條件」才寫入文件並建立一筆復原紀錄。檢查失敗保留草稿；若目標已被其他編輯更新，先「載入目前設定」再修改。

範例提示顯示已套用設定在第一筆資料的結果。畫布維持可選取的設計視圖，PDF 預覽反映實際隱藏與樣式。資料相關錯誤由「列印健檢」或 PDF 輸出檢查。

## 共用預檢

```ts
import { preflightDocument } from '@report-engine/report-engine/core';
const result = preflightDocument(document, {
  executionTime: '2026-10-24T00:00:00Z',
  timeZone: 'Asia/Taipei'
});
// { valid, errorCount, warningCount, diagnostics, executionTime?, timeZone? }
```

結果包含結構、JSON 資料、繫結、公式、越界、重疊與分頁問題。錯誤阻止 PDF／MCP apply；重疊與流式區段的 keepTogether 提示是警告。可加 `execute: false` 只做靜態檢查，此時不代表已驗證實際資料運算。

診斷提供 code、severity、category、path，以及適用的 bandId、controlId、subReportControlPath、rowIndex、span。設計器的定位可進入一層子畫布；更深的巢狀問題選取最接近的可編輯父控制項，完整 JSON 路徑仍保留。

HTTP `POST /api/preflight-report` 接受 `{ ...document, executionTime?, timeZone?, execute? }`。合法 JSON 文件的驗證結果以 HTTP 200 回傳，包含 `valid: false` 的結構／資料錯誤；請求選項錯誤或無效 JSON 為 400。PDF 輸出入口遇到預檢錯誤則回傳 422 與 diagnostics。MCP 對應工具見 [mcp-changes.md](mcp-changes.md)。
