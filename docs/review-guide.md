# 本輪檢視指引

本輪在自訂資料來源、PDF 分頁、套件嵌入與編輯操作上，加入列印健檢／定位、MCP 預檢後套用、條件式列印與真實瀏覽器／CI 驗證。仍維持獨立 Report Engine MVP。

## 先看畫面

1. 開啟設計器，在同一 Band 按 Shift 點選多個控制項，試拖曳、對齊及等距分布。
2. 用 Ctrl／Cmd+C、V、D 複製／貼上／快速複製；Delete 刪除；Ctrl／Cmd+Z 及 Shift+Z 復原／重做。文字輸入框的快捷鍵仍交給瀏覽器。
3. 「資料來源」可編輯 schema、parameters、items，也能匯入／匯出完整 JSON 文件。匯入 `examples/custom-invoice.json`，在計算欄位確認 amount／total，預覽的總計應為 49。
4. 選擇 description 欄位，可看到「長文字自動增高／跨頁」選項。切換自訂 schema 後，欄位目錄、MCP 發現與預覽會使用同一份資料。
5. 「重設範本」回到該設計器初始化時的文件；本輪操作可復原，外部重新載入則清除舊歷史。
6. 匯入 `examples/conditional-invoice.json`，查看右側「條件式列印」。預覽應有 POSITIVE-ITEM、紅色的 NEGATIVE-ITEM，沒有 HIDDEN-ITEM，總計為 20。條件草稿需按「套用條件」；故意填 `=quantity` 會被 boolean 型別驗證拒絕。
7. 開啟「列印健檢」，點選問題旁的定位按鈕。可在規格定義將控制項 x 改為 1000 測試越界阻擋，之後復原。固定區段的 keepTogether 開／關案例可直接看 PDF 回歸檢視頁。

預覽服務可用隔離文件啟動，保留既有使用者範本：

```powershell
$env:REPORT_ENGINE_LAYOUT_FILE = (Join-Path $PWD 'scratch/review-layout.json')
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

## 再看輸出及嵌入

- 執行 `npm run test:pdf`，開啟 `tmp/pdfs/regression/index.html`，可逐頁比較一般表格、長文、多行表格、子報表、分組及大型資料。
- 執行 `npm run build:package` 後，在開發伺服器開啟 `/examples/embedded.html`。兩個設計器各有文件、歷史與剪貼簿；按 Change left title 或只編輯左側，右側保持原狀。
- Agent 先呼叫 `get_report_data_source`、`get_available_data_fields` 與 `get_formula_catalog`，再用 `preview_report_changes` 查看差異及診斷，將 version 作為 baseVersion 交給 `apply_report_changes`；切換 schema、計算欄位與版面可以在同一批提交。

## 驗證與邊界

完整流程為 `npm run check`：lint、型別、56 項核心／同步／HTTP 測試、22 工具 MCP 整合、10 組 54 頁 PDF 視覺回歸、前端 bundle 預算、package 建置與獨立 consumer 安裝、5 個真實 Chromium 測試。首次需安裝 Playwright Chromium；`npm run test:package` 需要 registry 連線。詳見 [testing.md](testing.md)。

這版提供 0.2.0 的套件契約，尚未發布 npm。宿主仍負責登入、授權、資料查詢與正式儲存；本機同步沒有資料庫交易或多人合併。子畫布編輯仍是一層，分組仍是一層。語言偏好目前共用；部分介面文案尚待完整 i18n。AgentCopilot 是操作示範，真實 Agent 使用 MCP。CI 由推送觸發，遠端執行結果以 GitHub Actions 為準。

詳細 API 見 [embedding.md](embedding.md)，分頁規則與基準維護見 [pdf-pagination.md](pdf-pagination.md)。
