# 計畫 004 — CI 驗證基線（check workflow + scripts/check.js）

- **來源發現**: DX-01、DX-02、TEST-01、TECH-04 的防再犯檢查
- **嚴重度**: MED（是其他計畫的安全網）｜**工作量**: S｜**修法風險**: LOW
- **撰寫時的基準 commit**: `7105c32`
- **依賴**: 建議在計畫 005 的 groq slug 修正之後啟用（否則 parity 檢查會立刻紅燈 — 那正是它的功用）

## 背景

本 repo 沒有任何驗證：無 package.json、無測試、無 lint；`.github/workflows/deploy.yml` 直接把 repo 根目錄
上傳到 GitHub Pages。最近手工修過的 bug（copy 指令損壞 `b71d25a`、輸出空白、模型清單漂移 `55c5831`、
`e112147`）全都是靜態檢查就能擋下的類型。所有「測試」目前都是開瀏覽器手動點七個頁面。

本計畫新增**零依賴**的靜態檢查（node 內建模組即可，runner 預裝 node 24），
在 deploy 前執行，擋住：JS 語法錯誤、i18n 語言鍵集漂移、`?v=` 快取破版不一致、
groq catalog 與 UI 清單分歧、models.js registry 結構錯誤。

## 現況

`.github/workflows/deploy.yml`（38 行）：checkout → configure-pages → upload-pages-artifact（`path: '.'`）→ deploy-pages。
觸發：push 到 main + 手動。無任何 check。

快取破版現況：translations/storage/i18n 用 `?v=20260630`（7 頁一致）、models.js 用 `?v=20260829`（4 頁一致）。
models.js 的 `?v=` 必須等於其 `VERSION` 常數（目前皆為 20260829）。

`model-catalog.groq.json` 的 slug 例：`qwen/qwen3-32b`、`moonshotai/kimi-k2-instruct`（修正後）、
`openai/gpt-oss-120b`；codex-cli.html 內的 groq 清單（:447）必須是 catalog slugs 的子集
（這是「下載的 catalog 必須涵蓋 UI 提供的模型」的不變量）。

## 要做的事（依序）

1. 新增 `scripts/check.js`（node 內建模組，無依賴），依序執行並在任一失敗時 `process.exit(1)`，每項檢查印出 PASS/FAIL 與細節：
   - **A. JS 語法**：對每個根目錄 `*.js` 直接 `new vm.Script(source)`；對每個 `*.html` 以 regex
     抽出所有 inline `<script>`（不含 `src=`）逐塊 `new vm.Script(block)`。
   - **B. i18n 鍵集**：以 `vm` 載入 `translations.js`（stub `window={}`），對每個語言的鍵集合
     （排除 meta 欄位如 `nativeLabel`）與 `en` 鍵集合做差集，任何差異即 FAIL。
   - **C. `?v=` 一致性**：從所有 HTML 抽出 `<script src="X?v=N">`；斷言 `translations.js`/`storage.js`/`i18n.js`
     在 7 個頁面的 `?v=` 全部相同；`models.js` 的 `?v=` 全部相同且等於 `models.js` 內的 `VERSION` 數字。
   - **D. groq parity**：讀 `model-catalog.groq.json` 取 slug 集合；從 `codex-cli.html` 的 groq provider
     `models:[...]` 抽 id 集合；斷言後者 ⊆ 前者。
   - **E. registry 健全性**：以 `vm` 載入 `models.js`，斷言 `BYOK_MODELS.providers["ollama-cloud"].models`
     共 21 筆、第一筆 slug 為 `glm-5.3-flash:cloud` 且 `priority === 100`、其餘 priority 為 20、
     id 依字母排序（第 2 筆起）。
2. 新增 `.github/workflows/check.yml`：

```yaml
name: check
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node scripts/check.js
```

3. 在 `deploy.yml` 加一個 job 間依賴（`deploy-needs-check`）：`deploy` job 加 `needs: check`（同一 workflow 檔或以 `workflow_run` 串接；最簡單是把 check 直接放進 deploy.yml 的第一個 job，`deploy` 加 `needs: check`）。
   若採「放進 deploy.yml」的作法，就不需要獨立的 check.yml — 兩者擇一，**優先**併入 deploy.yml。
4. README 不用改（計畫 006 會一併處理），但在 `scripts/check.js` 檔頭寫 2-3 行註解說明用途與如何本機執行（`node scripts/check.js`）。

## 驗證（done criteria）

- `node scripts/check.js` 在本地全綠（輸出每項 PASS）。
- 負向測試（臨時改壞後還原，放 /tmp 或用 git stash）：(a) 在任一 HTML 的 script 加 `const x = {` → check A 失敗；(b) 刪掉 en 的一個鍵 → B 失敗；(c) 把一個頁面的 `storage.js?v=` 改成別的值 → C 失敗；(d) 把 inline groq 的 id 改成 catalog 沒有的 → D 失敗。
- 推到分支開 PR，GitHub Actions 的 check job 綠燈；deploy job 在其之後。

## 邊界

- **零新依賴**：不用 eslint/html-validate/lychee；只用 node 內建。若某些檢查在 CI 環境不可行（例如無法解析 HTML），降級為子集並在回報中說明，不要引入 npm 安裝。
- **不要**改動任何頁面程式碼；若檢查 D 失敗是因為 inline groq 清單本來就有錯（`qwen-3-32b`），那是計畫 005 的修復對象 — 先確認 005 已完成，否則此檢查紅燈是**預期行為**。
- `scripts/check.js` 不得讀取或輸出任何金鑰內容（repo 內本無，僅守則提醒）。

## 維護注意

- 新增第 8 個 HTML 頁時，檢查 A/C 自動涵蓋（用 glob，不要寫死檔名清單 — 用 glob 掃 `*.html`）。
- 計畫 001-003 的驗證都會用到此 script 的 A 項；落地後把「抽出 inline script + node --check」從人工步驟變成 `node scripts/check.js`。

## 逃生口

- 若 `translations.js` 的鍵集本來就不對齊（B 立刻失敗且差異巨大），先只開 A/C/E 三項、B 以 `--report` 模式列出差異不擋 CI，**回報差異內容**後再決定是否收緊。