# 計畫 002 — 各頁面 innerHTML 渲染的 XSS 跳脫

- **來源發現**: SEC-03（HIGH）、CORRECTNESS-05、SEC-09（潛在）
- **嚴重度**: HIGH｜**工作量**: S-M｜**修法風險**: LOW
- **撰寫時的基準 commit**: `7105c32`

## 背景

七個工具頁的供應商卡片、collection 列表、摘要 chips 都以 `innerHTML` + 樣板字串渲染，
內插的使用者可控欄位（provider 名稱、顏色、model 字串、alias 名稱）**未經跳脫**。
這些值可透過 `#cfg=` 分享連結（頁面載入自動採用，不需點擊）、備份匯入、或「新增提供商」modal 進入。
攻擊者傳一個 provider 名稱為 `<img src=x onerror=...>` 的分享連結，受害者開頁即執行。
全站沒有 CSP（見計畫 004 的附帶說明），所以跳脫是唯一的防線。

**唯一已正確跳脫的地方**：各頁的語法高亮 helper（`copilot-cli.html:888-889` 的 `esc`/`esch`、
`litellm.html` 的 `esch`）——**不要動它們**，它們是本次要新增 helper 的示範。

## 現況程式碼（逐字摘錄，行號為 `7105c32`）

`copilot-cli.html:914-919`（供應商卡片）：

```js
    el.innerHTML =
      `<button class="prov-del" title="${window.t?window.t('common.deleteProvider'):'Delete provider'}" type="button">✕</button>` +
      `<span class="mono-badge" style="background:${p.color || '#74e0a0'}">${p.badge || p.name.slice(0,2).toUpperCase()}</span>` +
      `<span class="pname">${p.name}</span>` +
      `<span class="ptype">type=${p.type || 'openai'}</span>`;
```

`copilot-cli.html:1236-1240`（collection 列）：

```js
    row.innerHTML =
      `<span class="ci-name">${c.name}</span>` +
      `<span class="ci-meta">${c.shell} · ${c.kind} · ${c.provider}/${c.model}</span>` +
      `<button class="ci-x" title="remove">✕</button>`;
```

其他同型 sink（逐一確認後修改）：
- `copilot-cli.html` ~`:1138` 摘要 chips（`${v}` 內插 provider 名稱／model 字串）
- `codex-cli.html` ~`:622-626`、~`:793`
- `claude-code.html` ~`:776-786`（provider.name、baseURL）
- `opencode.html` ~`:801-805`
- `cursor.html` ~`:820-824`
- `litellm.html` ~`:490`
- `storage.js:297`（`header.innerHTML = ...${options.title}`）、`storage.js:351`（`hint.innerHTML = f.hint`）、`storage.js:364`（footer）

**exemplar**（跳脫 helper 的寫法）— `litellm.html`：

```js
function esch(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
```

注意：跳脫要涵蓋 `"`（屬性內插情境，如 `style="background:${p.color}"`、`title="..."`），
所以 helper 必須是**完整版**：

```js
function escHtml(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
```

## 要做的事（依序）

1. 在 `storage.js` 的 `BYOKStore` 同層級輸出一個全域 `window.BYOKEsc = { html: escHtml }`（IIFE 內定義、結尾與 `BYOKStore` 一起 export；照該檔現有的 export 樣式，`storage.js:410-416` 附近）。
2. 每個頁面把上列 sink 中**來自使用者/分享資料的內插**改為 `${BYOKEsc.html(...)}`：
   - `p.name`、`p.badge`、`p.type`、`c.name`、`c.provider`、`c.model`、`options.title`、`f.hint`、provider/baseURL 顯示值、chips 值。
3. `p.color` 特殊處理：它是內插進 `style="background:..."` 的屬性。改成白名單驗證：
   `const color = /^#[0-9a-fA-F]{3,8}$/.test(p.color || "") ? p.color : "#74e0a0";`
   （不套 HTML 跳脫，因為白名單已經限制字元集；兩者擇一，**用白名單**。）
4. `f.hint`／`options.title` 在 `storage.js`：這些 API 目前只收靜態／i18n 字串，但 API 允許任意 HTML。
   最小修法：`header.innerHTML`／`hint.innerHTML` 改為 `textContent`（版面若需要換行，用 CSS `white-space: pre-line`），
   或對值套 `BYOKEsc.html`。擇一，優先 `textContent`。
5. **不要**動語法高亮 helper（`esc`/`esch`/`hlJSON`/`hlYaml`）、不要動 `i18n.js`（`translations.js` 是靜態資料，`i18n.js:160` 的 innerHTML 風險不在本次範圍）。

## 驗證（done criteria）

- 所有 HTML 的 inline script 通過 `node --check`（見計畫 004 `scripts/check.js`）。
- grep 斷言（一次性，放 /tmp 執行）：上述每個 sink 檔案中，`p.name`、`c.name` 等欄位在 `innerHTML` 樣板字串內的出現處都有 `BYOKEsc.html(` 前綴；`p.color` 的內插前面有白名單正則。
- 手動：用一個帶 `<img src=x onerror="alert(1)">` provider 名稱的 `#cfg=` 分享連結開頁 → 不應彈出 alert，名稱應以純文字顯示；再從「新增提供商」modal 輸入同名稱 → 同樣不執行。

## 邊界

- **只改** 上述 sink 的渲染行；不改任何資料結構、localStorage 格式、分享編碼。
- `i18n.js`、`translations.js`、語法高亮 helper：out of scope。
- 若某個 sink 的值**設計上就是 HTML**（目前沒有），停下來回報，不要硬改。

## 維護注意

- 新增渲染時一律用 `textContent` 或 `BYOKEsc.html`；code review 時 grep `innerHTML` 為例行檢查。
- 計畫 004 的 CI 可加一條規則：`innerHTML` 出現處的相鄰 5 行內若含 `${p.` / `${c.` 需有 `BYOKEsc.html`。

## 逃生口

- 若發現某頁的渲染函數被 `#cfg=` 之外的第三個入口餵資料（例如 URL query），**照常跳脫**並在回報中註記入口，不要只修分享連結路徑。