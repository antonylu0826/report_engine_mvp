# MCP 預檢與版本化套用（0.2.0）

目前共 22 個工具。Agent 可用 `get_formula_catalog` 發現可執行函式，`get_available_data_fields` 取得目前欄位、計算欄位、條件樣式能力及變更工具名稱。所有工具提供統一的 `structuredContent`：

```ts
interface ReportToolOutcome {
  success: boolean;
  code: string;                 // OK, NO_CHANGES, VALIDATION_FAILED, VERSION_CONFLICT, ...
  tool: string;
  version?: string;             // 目前儲存文件或套用後的版本
  message?: string;
  diagnostics: ReportDiagnostic[];
  data?: unknown;
}
```

失敗時 `isError: true`。既有工具的文字／JSON content 保留原格式；新工具 content 與 structuredContent 都使用此 envelope。TypeScript 型別可由套件 `/mcp` 匯入，診斷型別由 `/core` 匯入。

## 建議流程

1. 讀取 `get_report_layout` 與 `get_report_data_source`；查詢公式與欄位目錄。
2. 用 `preview_report_changes` 提交候選變更，取得共用預檢結果、目前版本與 before／after 差異。此工具不寫檔。
3. 檢視結果後，將相同 changes 與回傳 version 作為 baseVersion 交給 `apply_report_changes`。
4. 套用會再次驗證完整候選文件，再以版本檢查寫入一次。衝突時重新讀取並重建變更，不以新版本直接重送舊內容。
5. 使用 `export_pdf` 輸出目前已儲存的範本及資料。

為重現 NOW／TODAY，preview 與 apply 傳入相同 executionTime／timeZone；省略時每次呼叫使用各自的執行時間，預設時區 UTC。

## Changes 格式

```json
{
  "baseVersion": "讀取或預檢回傳的版本",
  "changes": {
    "operations": [
      {
        "type": "update_control",
        "bandId": "detail",
        "controlId": "amount",
        "patch": {
          "visibleWhen": "=quantity > 0",
          "styleRules": [{ "when": "=calc.amount < 0", "style": { "color": "#dc2626" } }]
        }
      }
    ]
  },
  "executionTime": "2026-10-24T00:00:00Z",
  "timeZone": "Asia/Taipei"
}
```

`changes` 可含完整 report、dataSource，以及最多 200 筆 operations；至少提供一項。先套用完整覆寫，再依序執行 operations，最後對整份文件驗證。切換 schema、計算欄位與控制項可在同一批完成。

| operation type | 必要欄位 |
| --- | --- |
| update_control | bandId、controlId、patch |
| add_control | bandId、control（包含唯一 id） |
| delete_control | bandId、controlId |
| update_band | bandId、patch |
| set_calculated_fields | calculatedFields（完整集合） |

各 operation 可加 `subReportControlId` 指向子報表作用域。update_band 支援 height、keepTogether、visibleWhen、controls、groupBy、groupSortOrder、pageBreakBefore／After；新增／刪除 Band 或變更紙張可提交完整 report。

update_control 的 visibleWhen／styleRules 可用 null 清除；update_band 的 visibleWhen／groupBy 也可用 null 清除。控制項 style 沿用既有合併規則。任一目標不存在、結構錯誤、執行時公式或幾何錯誤，都不寫入部分結果。

預檢 data 包含 `applied: false`、summary、validation；summary 的 differences 最多 100 筆，過長字串截至 500 字元，並提供 changeCount／truncated／資料筆數。它是檢視摘要，不能直接當作可重播 patch。

apply 必須帶 baseVersion；preview 可省略它，帶入時也會拒絕過期版本。無內容變更回傳 NO_CHANGES，版本及檔案不變。validation 同時檢查實際資料；警告可通過，錯誤回傳 VALIDATION_FAILED。儲存前版本不同則回傳 VERSION_CONFLICT。

## 單獨預檢與相容性

`preflight_report({ document?, execute?, executionTime?, timeZone? })` 預設檢查目前儲存文件，也能唯讀檢查候選 ReportDocument。execute 預設 true。資料、版面及公式使用與設計器／PDF 相同的診斷。

既有寫入工具新增可選 expectedVersion，省略時保留原有操作方式；它們維持原本驗證範圍。新 Agent 建議使用 preview／apply，確保實際資料與列印預檢也通過。

宿主 repository 的 write 必須實作 expectedVersion 檢查；本機檔案 adapter 使用內容版本及暫存檔替換。這不是多程序資料庫交易或自動合併服務，正式多人協作仍由宿主的儲存服務提供。
