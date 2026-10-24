# PDF 分頁與長內容

## 行為契約

固定控制項維持 pt 座標。一般固定 Band 會整列移到下一頁，避免一列中的絕對定位欄位被切成重複或缺少內容的兩半。Band 基本高度、控制項最小高度超過可用頁面時，會在輸出前回報可讀錯誤（HTTP 422），不接受靜默裁切。

固定 Band 的 `keepTogether` 預設 true；設為 false 時可在完整控制項列之間拆頁。屬性面板的「固定區段保持同頁」控制此設定。canGrow／SubReport 區段仍依流式規則跨頁，keepTogether 不會鎖住整個長內容區塊，健檢會提示舊範本的此類設定。顯示條件為 false 的 Band 收起全部空間；控制項隱藏保留 Band 的基本高度。

`Label`、`Field`、`Expression` 可設定 `canGrow: true`，也可在屬性面板勾選「長文字自動增高／跨頁」。height 是最小高度，實際文字交由 PDF 排版引擎換行，必要時跨頁。以原始 y 範圍重疊的控制項視為同一列；列內保留座標，後續列會被長內容向下推移。未啟用 canGrow 的文字保留原本固定區域契約。

`SubReport` 使用相同流式列邏輯，子資料列整列換頁，子 `PageHeader` 在該子報表的續頁重複；空陣列不產生子資料。父報表後續內容會接在子報表之後。父 Band 的 keepTogether 不會強制把跨頁的整個子報表鎖在同一頁；固定資料列始終保持完整。

頁首、頁尾是固定區域，不能放 growable 文字或 SubReport；必須預留足夠頁面本文空間。整頁背景／裝飾線與 Panel 保留固定幾何，不會自動延伸為多頁表格邊框。SVG inspector 是幾何概覽，長文字高度及實際分頁請看 PDF。

## 視覺回歸

```sh
npm run test:pdf
# 開啟 tmp/pdfs/regression/index.html
```

測試實際生成 PDF，使用 PDF.js 與原生 Canvas 逐頁算繪 PNG，檢查：

1. 每筆識別文字、長文字行尾、子報表結尾及報表結尾完整，且只出現一次。
2. 頁首／頁碼在每頁正確出現，子報表續頁有子表頭。
3. 文字座標位於頁面邊界內，逐頁文字與座標的 checksum 符合基準。
4. 每頁 PNG 的 1,024 bit perceptual hash 符合基準；允許少量 rasterizer 差異。
5. 條件式列印的隱藏文字不出現、負數有紅色像素；keepTogether 開／關的識別文字位於指定頁面。

10 組共 54 頁資料集包含條件式內容、保持同頁／逐列拆分、空資料、95 筆一般表格、95 行中英長文、20 筆多行表格、95 筆子報表、兩個分組與 1,000 筆大型資料。基準存在 `tests/fixtures/pdf-baseline.json`。每頁 PNG、PDF 和 HTML 檢視頁在 tmp，屬於產物，不加入 Git。

```sh
npm run test:pdf:update
```

這個指令只在已確認的排版變更時使用。更新後需逐頁檢視產生的 PNG，特別檢查首尾頁、長文字接頁、子表頭與頁尾；不要只因 checksum 失敗就接受新基準。固定 executionTime 讓日期／時間不影響比對。視覺回歸是已列出資料集的驗證，並非所有任意幾何、巢狀層級或字型的排版保證。
