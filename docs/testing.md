# 驗證與 CI

目前本機驗證環境為 Node 26.12.1、npm 11.20.0、Windows。安裝完整開發依賴及 Playwright Chromium 後執行：

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

check 依序執行 lint、TypeScript、56 項核心／HTTP／同步測試、真正 MCP client 整合、10 組共 54 頁 PDF 回歸、前端 bundle 預算、套件建置、獨立 npm consumer，以及 5 個真實 Chromium 流程。package consumer 會從 registry 安裝依賴，需要網路。

| 指令 | 範圍 |
| --- | --- |
| npm test | 公式、條件、診斷、儲存／競態、HTTP、狀態、PDF |
| npm run test:mcp | 22 個工具註冊、實際 stdio client、資料／公式／寫入／匯出 |
| npm run test:pdf | PDF 文字、幾何、頁碼、隱藏內容、條件顏色、逐頁視覺基準 |
| npm run build | 正式應用；單 chunk 500 kB、首頁 JS 650 kB 預算 |
| npm run build:package | ESM、型別、字型、文件及範例 |
| npm run test:package | 打包後安裝至獨立專案，嚴格 NodeNext 型別及執行測試 |
| npm run test:e2e | 實際瀏覽器操作，先執行 build:package |

## 瀏覽器流程

測試使用明確的 zh-TW 瀏覽器語言，真實 Vite、HTTP PDF 與 stdio MCP；沒有替換核心服務。包含：

1. 匯入條件式文件、拒絕錯誤條件草稿、套用正確條件，讀取實際預覽／下載 Blob 的 PDF 文字，確認隱藏列及總計。
2. 版面越界診斷、點選定位，以及同一錯誤阻擋 PDF。
3. 多選整組拖曳的一步復原、複製／重做、輸入框原生快捷鍵。
4. MCP preview 不寫檔、apply 同步進設計器、舊版本不能覆蓋較新的 UI 編輯。
5. 建置後的兩個設計器，確認文件、歷史、剪貼簿及 onChange 互不影響。

Playwright 啟動專用的 127.0.0.1:5189 伺服器，使用 `scratch/e2e/layout.json`；啟動時重建此測試文件，不碰 `current_report_layout.json`。埠已占用會明確失敗，不重用既有服務。失敗時保留 screenshot、trace 與 HTML report。

```sh
npx playwright show-report
npx playwright show-trace test-results/對應測試/trace.zip
```

PDF 基準更新及 PNG 視覺檢查方式見 [pdf-pagination.md](pdf-pagination.md)。測試涵蓋已列出的案例，沒有宣稱所有任意版面、瀏覽器或字型均已驗證。

## GitHub Actions

[check.yml](../.github/workflows/check.yml) 在 push／pull_request 或手動觸發時，於 Ubuntu 與 Windows、Node 26 執行相同 check。Action 使用固定 commit，權限為 contents: read，checkout 不保留憑證；各作業保留 Playwright 與 PDF 檢視產物 14 天。

上述驗證紀錄來自本機；遠端 CI 由提交推送觸發，執行結果以 GitHub Actions 為準。設定依 [Playwright CI](https://playwright.dev/docs/ci) 與 [webServer 文件](https://playwright.dev/docs/test-webserver)，Node／checkout 設定見 [setup-node](https://github.com/actions/setup-node) 與 [checkout](https://github.com/actions/checkout)。
