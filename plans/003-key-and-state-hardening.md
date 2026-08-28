# 計畫 003 — 分享／匯入狀態強化：keyLiteral 不外流、輸入驗證、版本升級資料合併

- **來源發現**: SEC-04（HIGH）、SEC-06（MED）、CORRECTNESS-01/02/06/09/11/12
- **嚴重度**: HIGH｜**工作量**: M｜**修法風險**: MED（需合併策略，不可弄丟使用者資料）
- **撰寫時的基準 commit**: `7105c32`

## 背景

三個相互疊加的問題：

1. **keyLiteral 明文外洩**（SEC-04）：`copilot-cli.html` 的 `keyLiteral`（密碼欄位，:418）被放進
   `state`（:725）→ `saveState()` 明文存進 localStorage（:740-747）→ 分享按鈕把整個 `state` 壓縮進
   `#cfg=` URL（:1305-1311 + `storage.js` `shareCurrentPage`）。README 承諾「金鑰只以環境變數名稱參照」，
   literal 模式直接違反承諾。
2. **不受信任的分享／匯入資料無驗證**（SEC-06、CORRECTNESS-06/11/12）：分享連結載入時
   `PROVIDERS = shared.providers`、`Object.assign(state, shared.state)`，只有 `Array.isArray` 檢查；
   `storage.js` 的 `importBackup` 在缺 `pages` 鍵時把任意 JSON 的每個 top-level key 當成 page 合併（:196-206）；
   decompress 無大小上限；`__proto__` 鍵可穿透 `Object.assign`。
3. **modelsVersion 守衛有兩個漏洞**（CORRECTNESS-01/02）：
   - 分享連結的舊 providers 被採用後，`saveState()` 立刻蓋上**目前** registry 版本 → 舊清單偽裝成最新版，
     守衛從此永遠通過（copilot `init()` 分享分支 `saveState()` 在 :1326）。
   - 版本不符時**整份丟棄** saved providers → 使用者自建的 provider（存在同一份陣列裡）每次 bump 都消失。

## 現況程式碼（逐字摘錄，行號為 `7105c32`）

`copilot-cli.html:1318-1333`：

```js
async function init(){
  // Check shared URL hash first
  const shared = await window.BYOKShare.getSharedData();
  if(shared){
    if(Array.isArray(shared.providers)) PROVIDERS = shared.providers;
    if(shared.state) Object.assign(state, shared.state);
    if(Array.isArray(shared.collection)) collection = shared.collection;
    saveState();
    window.BYOKToast.show(window.t ? window.t("common.sharedLoaded") : "Settings loaded from share link ✓");
  } else {
    // Load from local storage
    const saved = window.BYOKStore.getPage("copilot", null);
    if(saved){
      // adopt saved providers only if they were saved with the same model registry version
      if(Array.isArray(saved.providers) && saved.modelsVersion === ((window.BYOK_MODELS && window.BYOK_MODELS.version) || 0)){
```

`storage.js`（importBackup 尾段）：

```js
        // :196-206 附近 — 缺 pages 時整份 parsed 被當 pages 合併
        Object.assign(all.pages, parsed.pages || parsed);
```

（確切寫法以 `storage.js:196-210` 為準，先讀再改。）

四個頁面（codex :958-968、copilot :1320-1333、claude-code :1090-1099、opencode :1248-1257）共用同一模式。

## 要做的事（依序）

### A. keyLiteral 不落地、不分享（copilot-cli.html）

1. 定義 `function stateForStorage(){ const s = Object.assign({}, state); s.keyLiteral = ""; return s; }`。
2. `saveState()` 改存 `state: stateForStorage()`；`shareHandler` 改為
   `BYOKShare.shareCurrentPage({ providers: PROVIDERS, state: stateForStorage(), collection })`。
3. UI 行為：keyMode 切到 literal 時輸入的 key 仍在頁面記憶體中（state），重新載入後清空 — 在 keyHint 文字**不加新承諾**，維持現有文案即可；不要動 `genShellAlias` 等產生邏輯（snippet 內嵌 literal 是使用者主動選擇，屬 UI 功能）。

### B. 分享／匯入資料消毒（storage.js）— **修訂版：sanitize 帶選項**（REVISE round 1）

1. 新增 `BYOKShare.sanitize(data, opts)`（在 `BYOKShare` 物件內）：
   - 若非物件回傳 `null`。
   - **遞迴刪除**鍵名為 `__proto__`、`constructor`、`prototype` 的鍵（所有模式一律生效）。
   - 反序列化後的 JSON 字串長度上限 1 MiB、`#cfg=` 原始長度上限 64 KiB（超過回 `null`）。
   - `providers` 若存在：只保留 `Array` 中每個「有 string `id` 與 string `name`」的項目，並確保 `models` 是陣列（缺則補 `[]`）。
   - `state` 若存在：**`opts.strictState === true` 時**只保留值型別為 string/number/boolean 的鍵；**未帶 opts 時**保留 array/plain-object 值（已遞迴 proto 清理），以保留 litellm 的 `state.entries` 等結構化欄位。
2. `getSharedData(opts)` 與 `decompress(str, opts)` 透傳 opts；回傳前過 `sanitize`。四個 in-scope 頁面（copilot-cli/codex-cli/claude-code/opencode）改呼叫 `getSharedData({ strictState: true })`（其 state 為扁平 primitive，嚴格模式為 no-op，但防未來新增 nested 欄位時的污染）；cursor/litellm 維持無參數呼叫。
3. `importBackup`：只接受 `parsed.pages` 為物件的備份（`parsed.pages && typeof parsed.pages === "object" && !Array.isArray(parsed.pages)`），否則提示無效並 return；合併前對每個 page 以**寬鬆模式**（不傳 strictState）過 `sanitize`。
4. `decompress` 的每個 `JSON.parse` 分支：結果過 sanitize；parse 前檢查 text 長度上限。

### C. 版本升級合併策略（四頁共用行為，分別實作）

新增共用 helper 到 `storage.js` 的 `BYOKStore`：

```js
    mergeProviders(defaults, saved) {
      // defaults: 由 registry 推導的新清單（array 或 object map）
      // saved: 使用者儲存的清單
      // 規則：id 存在於 defaults 的 → 用 defaults（registry 為準）；
      //       defaults 沒有的（使用者自建）→ 保留 saved 的那份
      const isArray = Array.isArray(defaults);
      const defIds = new Set(isArray ? defaults.map(p => p.id) : Object.keys(defaults));
      const extra = isArray
        ? (saved || []).filter(p => p && !defIds.has(p.id))
        : Object.fromEntries(Object.entries(saved || {}).filter(([k]) => !defIds.has(k)));
      return isArray ? defaults.concat(extra) : Object.assign({}, defaults, extra);
    },
```

各頁 restore 邏輯改為（以 codex 為例，其他三頁同型）：

```js
      const regVersion = (window.BYOK_MODELS && window.BYOK_MODELS.version) || 0;
      if(Array.isArray(saved.providers)) PROVIDERS = window.BYOKStore.mergeProviders(PROVIDERS, saved.providers);
```

（`PROVIDERS` 此時已是 registry 推導的 defaults。）分享連結分支同樣改用 `mergeProviders`，
**並刪除分享分支裡的立即 `saveState()`**——改為不存，或存 `modelsVersion: 0` 以便下次載入重新合併（擇後者，保留分享狀態的即時性但不再偽裝為 registry-current）。

### D. 渲染防禦（copilot-cli.html，搭配 002 已有的 esc）

1. 分享採用後與 localStorage 還原後，對每個 provider 補預設值：`p.models` 非 Array → `[]`；`p.name` 非字串 → `"provider"`（修 CORRECTNESS-06 的 `name.slice` 與 `models[0].id` crash；`p.name.slice(0,2)` 前先確保為字串）。
2. 刪除供應商後的重設（copilot ~`:928`）改為
   `state.modelId = (PROVIDERS[0] && Array.isArray(PROVIDERS[0].models) && PROVIDERS[0].models[0]) ? PROVIDERS[0].models[0].id : "default";`

### E. collection 過時碼（copilot-cli.html，CORRECTNESS-09）

1. 先讀 collection push 處（~`:1290-1300`）確認 item 欄位；新 push 的 item **不存 `code`**，改存 metadata + `stateSnapshot: stateForStorage()`（keyLiteral 不透過 collection 落地或分享 — REVISE round 1 裁決）。
2. 「全部複製」與單項複製時：以 `c.stateSnapshot` 暫時覆寫全域 `state` → 呼叫對應的 `generate()`（依 item 記錄的 shell/kind） → 還原 `state` → 收集輸出。
3. 舊 collection 項目（無 stateSnapshot）保留 `c.code` 原樣輸出（向後相容）。

## 驗證（done criteria）

- 所有改動檔案 `node --check` 通過。
- Node harness（/tmp，不提交）：`mergeProviders` 三個案例 — (a) saved 含自訂 id → 保留在尾端；(b) saved 的 registry id → 被 defaults 覆蓋；(c) object-map 形狀（claude/opencode）同樣通過。
- `sanitize` 案例：`{"__proto":1}` 與 `{"__proto__": {...}}`、超過 1 MiB 的字串、providers 含缺 name 的項目 → 全部被丟棄或淨化。
- keyLiteral 案例：`state.keyMode="literal"; state.keyLiteral="sk-secret"; saveState();` → `BYOKStore.getPage("copilot").state.keyLiteral === ""`；分享 URL decode 後不含 `sk-secret`。
- 手動：bump 前建立自訂 provider → 手動改 localStorage 的 modelsVersion 模擬舊版 → 重新載入 → 自訂 provider 仍在、ollama-cloud 清單為 21 個。

## 邊界

- **不要**改變分享 URL 的編碼格式（CompressionStream + base64url）本身；只加消毒與上限。
- **不要**動 cursor.html／litellm.html 的持久化（無 modelsVersion 守衛是已知事實，屬第二階段）。
- 產生片段中內嵌 literal key 的行為本身**不改**（那是功能；本計畫只管儲存與分享）。

## 維護注意

- 之後任何頁面新增「會存進 state 的機密欄位」，都必須加進 `stateForStorage()` 的剝除清單。
- `mergeProviders` 是第二階段（models.js 擴及全部 provider）的基礎；屆時 registry-managed 的判斷從「id 出現在 defaults」升級為「provider 有 registry 來源標記」。

## 逃生口

- 若 `state` 中有欄位被 `Object.assign` 之外的深層路徑還原（例如 nested objects 需要保留使用者自訂），**停下來回報**合併策略的衝突，不要自行發明三層合併。