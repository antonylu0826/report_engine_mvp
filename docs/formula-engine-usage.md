# 公式引擎 v1 使用方式

這一版維持獨立 Report Engine MVP。宿主準備 schema、主檔參數及 JSON 明細；目前沒有 Haneinfo 整合。PDF、列印及公式驗證共用 Node 核心。

## 啟動與編輯

```sh
npm install
npm run dev
```

「計算欄位」頁面可新增名稱、row／group／report 作用域、型別及公式。欄位選單、38 個函式的簽章與範例、原始值／格式化結果、群組／資料列試算都來自共用核心。選取 Expression 控制項時，也有相同的公式輔助介面。

公式編輯中的輸入留在編輯器，按「套用公式」或「套用計算欄位」後，才進入範本並自動儲存。靜態錯誤及循環會停用套用；沒有另外的發布流程。外部範本更新與本機輸入衝突時保留輸入並提示重新載入。

預覽及頂部「匯出 PDF」都呼叫後端。相同範本與資料共用已產生的 PDF；「重新產生」建立新的時間快照。資料或範本變更後先隱藏舊預覽，失敗時顯示診斷。

`npm run build` 後可用 `npm run preview` 驗證正式前端。兩種啟動方式都有 PDF API 與範本同步 API；Vite 使用 `--configLoader runner`，保留後端模組的原始路徑，避免設定檔打包改寫 `import.meta.url` 導致字型路徑失效。

目前磁碟範本不會自動改寫為新範例。新範例包含明細金額 → 小計 → 稅額 → 總計的計算鏈；要使用它，可先備份既有範本，再使用「重設範本」。

## 語法與計算欄位

```text
=quantity * unitPrice
=IF(quantity = 0, 0, amount / quantity)
=ROUND(calc.subtotal * params.taxRate, 0)
=SUM(calc.lineAmount)
=CONCAT(params.customerName, "／", params.orderNo)
=DATEADD("month", 1, "2024-01-31")
```

公式可帶前導 `=`，函式不分大小寫，欄位分大小寫。數值、字串、TRUE／FALSE／NULL、括號、算術及比較依目錄公布的優先順序解析。字串中的雙引號可寫成 `""`；也支援反斜線引號、反斜線、換行及 tab 跳脫。沒有 JavaScript 腳本或外部 I/O。

新增的範本屬性範例（這只是完整 ReportDefinition 的一部分）：

```json
{
  "calculatedFields": [
    { "name": "lineAmount", "scope": "row", "type": "number", "expression": "=quantity * unitPrice" },
    { "name": "subtotal", "scope": "report", "type": "number", "expression": "=SUM(calc.lineAmount)" },
    { "name": "tax", "scope": "report", "type": "number", "expression": "=ROUND(calc.subtotal * params.taxRate, 0)" },
    { "name": "total", "scope": "report", "type": "number", "expression": "=calc.subtotal + calc.tax" }
  ]
}
```

名稱為英文字母／底線開頭，後接英數字或底線；同一份報表內唯一。型別可選 number、string、boolean、date、datetime。單一報表最多 256 個計算欄位。

| 作用域 | 計算欄位可引用 |
| --- | --- |
| row | 原始列、主檔參數、其他 row 計算；不允許彙總。 |
| group | 主檔參數、同組 group 計算、以彙總取得同組 row 運算。 |
| report | 主檔參數、其他 report 計算、以彙總取得全表 row 運算。 |

控制項則使用所在 Band 的上下文：明細有目前列與群組；群組表頭／表尾可讀該組第一筆原始列；全表與頁面表頭／表尾使用全表上下文。子報表有自己的計算欄位、資料及彙總，沿用主檔參數與同次執行的時間。

明確名稱為 `row.field`、`params.field`、`calc.name`。裸名稱先找目前列，再找主檔；已在 row schema 宣告的欄位缺值時維持 null，不改讀同名參數。

目前已實作的函式如下。完整簽章、參數型別、預設值、空值規則及可執行範例，請查 `get_formula_catalog`；執行中的目錄與設計器使用同一份註冊表。

| 類別 | 函式 |
| --- | --- |
| number | ABS、ROUND、ROUNDUP、ROUNDDOWN、MOD |
| logical | IF、AND、OR、NOT、COALESCE、ISNULL |
| aggregate | SUM、COUNT、AVG、MIN、MAX |
| text | CONCAT、LEN、LEFT、RIGHT、MID、TRIM、UPPER、LOWER、SUBSTITUTE |
| date | DATE、TODAY、NOW、YEAR、MONTH、DAY、DATEADD、DATEDIFF、FORMAT_DATE |
| conversion | TO_NUMBER、TO_TEXT、TO_DATE、FORMAT_NUMBER |

## 值與邊界規則

- 使用 Decimal 的 34 位有效數字；運算按半值遠離零捨入，非零指數限於 -100 至 100。非有限值及超限回報錯誤。JSON 來源 number 已遺失的精度無法復原；精確小數文字可經 `TO_NUMBER` 轉換。
- 計算核心保留十進位值；只有輸出邊界才轉換。可精確往返的值回傳 JSON number，其餘回傳十進位 string，試算的 `type` 仍為 number。`exactValue` 提供精確文字，格式化也保留其位數。
- `ROUND(value, digits=0)` 半值遠離零；ROUNDUP 遠離零，ROUNDDOWN 朝零。digits 可為 -100 至 100。`formatString` 僅改變顯示。
- 一般函式與算術傳遞 null。IF 的 null 條件回傳 null；AND 中 false 優先、OR 中 true 優先，其餘保留 null。IF、AND、OR、COALESCE 短路求值，但靜態檢查仍涵蓋全部分支。
- SUM／COUNT 空集合為 0；AVG／MIN／MAX 空集合為 null。彙總忽略 null。COUNT() 計列數，COUNT(expression) 計非 null 結果。
- 日期使用 `YYYY-MM-DD`；datetime 使用含明確位移的 ISO。JSON schema 的 date 與 datetime 有明確區別，轉換須用 TO_DATE。模糊在地日期不自動猜測。
- 預設時區 UTC；呼叫端可傳 IANA 時區。NOW／TODAY 在單次執行固定；瀏覽器示範程式明確傳入瀏覽器時區。
- DATEADD 月份／年份遇月底採最後一天。DATEDIFF year／month／week／day 計完整日曆單位；hour／minute／second 計實際經過時間並朝零截斷。小時以下單位需要 datetime。
- FORMAT_DATE 支援 YYYY／yyyy、MM、DD／dd、HH、mm、ss，區分月份與分鐘。FORMAT_NUMBER(value, digits=2) 回傳固定小數位文字，digits 為 0 至 20。
- LEN／LEFT／RIGHT／MID 使用 Unicode code point，不切斷 surrogate pair；MID 從 1 起算。它們不做 grapheme cluster 分割。TRIM 只移除頭尾空白；SUBSTITUTE 替換全部相符文字。
- 單式限 8192 字元、2048 tokens、64 層語法樹；可變參數最多 256 個。文字輸入與結果限 100000 UTF-16 code units。

## MCP 流程

```sh
npm run mcp
```

先呼叫 `get_formula_catalog` 取得版本、語法、作用域、精度／日期／空值規則、每個函式簽章及可執行範例，再用 `get_available_data_fields` 取得範本的欄位、計算欄位及條件列印能力。工具清單現在有 22 個。

新增工具：

| 工具 | 用法 |
| --- | --- |
| get_formula_catalog | 可傳 category 或 name 篩選；只公布已實作函式。 |
| validate_report_formulas | 預設檢查儲存範本；可傳完整 report、schema、data、parameters，execute=true 時執行資料驗證。 |
| preview_formula | 傳 expression、scope、groupIndex、rowIndex；子報表加 subReportControlId 與 parentRowIndex。可傳 executionTime、timeZone、formatString。 |
| set_calculated_fields | 傳完整 calculatedFields 集合，子報表加 subReportControlId；任何靜態錯誤都不寫入。 |

建議順序：查目錄與欄位 → 試算 → preview_report_changes → apply_report_changes → 匯出。需要同時變更控制項、計算欄位及資料時，可在同一 changes 提交；預檢後帶 baseVersion 套用。詳見 [MCP 變更契約](mcp-changes.md)。公式也能用於 [條件式顯示與樣式](conditional-printing.md)。

MCP 的儲存文件現在包含自訂資料契約。使用 get_report_data_source／set_report_data_source 讀寫 schema、參數及 JSON 資料；唯讀驗證／試算仍可明確覆寫。切換 schema 時可一併提交 report。詳見 [嵌入與資料文件契約](embedding.md)。

## Node 與 HTTP

```ts
// 將此範例存為專案根目錄的 example.ts，再執行 npx tsx example.ts。
import { writeFile } from 'node:fs/promises';
import { renderReportPdf } from './src/server/pdfService.ts';
import { validateReportFormulas } from './src/formula/report.ts';
import { getFormulaCatalog } from './src/formula/registry.ts';
import { FormulaError } from './src/formula/types.ts';
import { sampleOrderReport, sampleOrderDataSource } from './src/mock/sampleReport.ts';

const report = structuredClone(sampleOrderReport);
const dataSource = structuredClone(sampleOrderDataSource);
const catalog = getFormulaCatalog();
const validation = validateReportFormulas(report, {
  schema: dataSource.schema,
  dataSource: dataSource.data.items,
  reportParameters: dataSource.data.parameters,
  execute: true,
  timeZone: 'Asia/Taipei',
});
if (!validation.valid) throw new FormulaError(validation.diagnostics);
// Throws FormulaError with diagnostics if any static or runtime formula is invalid.
const pdfBuffer = await renderReportPdf({ report, dataSource, timeZone: 'Asia/Taipei' });
await writeFile('example-report.pdf', pdfBuffer);
console.log(`Catalog ${catalog.version}: ${catalog.functions.length} functions`);
```

`dataSource` 為既有 `{id, name, schema: {parameters, detailFields}, data: {parameters, items}}`。欄位可加 `nullable: false`；被引用時若缺值或為 null，會產生 MISSING_VALUE。為了完整檢查未知名稱及型別，呼叫端應提供 schema；未提供時只能做語法、函式、計算依賴及實際取值檢查。

`npm run server` 在 127.0.0.1:3001 啟動獨立 API；可用 REPORT_ENGINE_PORT 改埠。這個入口接受呼叫端提供的資料，查詢、認證與授權由宿主處理。它不提供前端靜態檔案或 `/api/report-layout` 範本儲存。獨立部署前端時，將其同一來源的 `/api/formula-catalog`、`/api/validate-report-formulas`、`/api/report-pdf` 透過宿主或反向代理接到此服務；前端不會自動連往 3001 埠。

| HTTP | 契約 |
| --- | --- |
| GET /api/formula-catalog | 可傳 name／category 查詢參數。 |
| POST /api/validate-report-formulas | JSON body 同 PDF 請求，回傳 valid、diagnostics、dependencyOrder。 |
| POST /api/report-pdf | `{report, data?, parameters?, dataSource?, executionTime?, timeZone?}`，成功回傳 application/pdf。 |
| POST /api/preflight-report | `{formatVersion:1, report, dataSource, executionTime?, timeZone?, execute?}`，回傳共用結構／資料／公式／版面健檢。 |

JSON 請求最多 20 MiB，明細最多 10000 筆。形狀錯誤回傳 400，超過大小限制回傳 413。`/api/validate-report-formulas` 以 HTTP 200 回傳檢查結果，公式不合法時為 `valid: false` 與 diagnostics；`/api/report-pdf` 遇到公式錯誤則回傳 HTTP 422 與 diagnostics，不回傳部分 PDF。

診斷包含 code、message、path、span，並依來源提供 fieldName、scope、bandId、controlId、subReportControlId、rowIndex、groupKey、dependencyPath。span 是原始字串的 0 起算 UTF-16 半開區間；rowIndex 為所在資料範圍的 0 起算索引。

## 舊範本與回歸

既有範本不必新增 calculatedFields。SUM／COUNT／AVG、ROW_INDEX／INDEX 及頁碼文字樣板持續支援；PageNumber、TotalPages、ExecutionTime 在呈現階段代入，不得加入計算欄位依賴圖。

有意改變的語意：未知公式不再輸出原始文字；不再把非有限數或型別錯誤當成零；AVG 只計非 null 值，空平均回傳 null。需要以前的空值預設時，明確使用 COALESCE。

```sh
npm run check
```

回歸涵蓋所有目錄範例、全部簽章參數數量、數值／日期／文字邊界、作用域與依賴、子報表、PDF 阻擋、HTTP、真正 MCP client、預覽設定載入、同步衝突及 bundle 預算。測試版面隔離於 scratch，不覆寫使用者範本。

2026-10-24 驗證範圍：Node v26.12.1、npm 11.20.0；56 項核心／整合測試、MCP 22 個工具、10 組共 54 頁 PDF 視覺回歸、獨立 package consumer 及 5 個 Chromium 流程。首頁／chunk 的 650／500 kB 預算維持不變；完整指令與 CI 狀態見 [testing.md](testing.md)。
