# 計畫 001 — copilot-cli.html 產生輸出的 Shell／PowerShell 跳脫

- **來源發現**: SEC-01（bash 雙引號注入）、SEC-02（identifier 注入）、SEC-05（PowerShell 單引號 breakout）、CORRECTNESS-04
- **嚴重度**: HIGH（可造成 RCE）｜**工作量**: S-M｜**修法風險**: LOW
- **撰寫時的基準 commit**: `7105c32`

## 背景（為什麼重要）

`copilot-cli.html` 產生要貼進 `~/.bashrc`／`~/.zshrc`／PowerShell `$PROFILE` 的 alias 與 function。
這些片段內嵌多個使用者可自由編輯的值（base URL、model id、alias 名稱、literal API key、resource 名稱）。
這些值也會透過 `#cfg=` 分享連結**在頁面載入時自動整批採用**（見計畫 003），因此攻擊者可以
傳一個含惡意 `baseUrl` 的分享連結：受害者複製產生的 alias 貼進 rc 檔後，**下次開 shell 即任意指令執行**。

bash 的雙引號**不會**中和 `$()`、反引號；PowerShell 的單引號遇到 `'` 會提前結束字串。
同 repo 的 `cursor.html` 已有正確示範（見下方 exemplar），copilot-cli 沒有套用。

## 現況程式碼（逐字摘錄）

`copilot-cli.html`（行號為 commit `7105c32` 時點）：

```js
// :775-784
function shellKeyValue(){
  const p = provider();
  if(!p || !p.keyRequired) return null;
  if(state.keyMode === "env"){
    const n = (state.keyEnv || p.keyEnv || "API_KEY").trim() || "API_KEY";
    return "$" + n;
  }
  return '"' + (state.keyLiteral || "YOUR-API-KEY") + '"';
}

// :801-815
function envPairs(kind){
  const p = provider();
  const pairs = [];
  if(state.offline) pairs.push(["COPILOT_OFFLINE", kind==="ps" ? "'true'" : "true"]);
  pairs.push(["COPILOT_PROVIDER_TYPE", kind==="ps" ? `'${p.type}'` : `"${p.type}"`]);
  pairs.push(["COPILOT_PROVIDER_BASE_URL", kind==="ps" ? `'${baseUrl()}'` : `"${baseUrl()}"`]);
  const key = kind==="ps" ? psKeyValue() : shellKeyValue();
  if(key !== null) pairs.push(["COPILOT_PROVIDER_API_KEY", key]);
  pairs.push(["COPILOT_MODEL", kind==="ps" ? `'${modelString()}'` : `"${modelString()}"`]);
  const wire = wireValue();
  if(wire) pairs.push(["COPILOT_PROVIDER_WIRE_API", kind==="ps" ? `'${wire}'` : `"${wire}"`]);
  if(state.maxPrompt) pairs.push(["COPILOT_PROVIDER_MAX_PROMPT_TOKENS", kind==="ps" ? `'${state.maxPrompt}'` : `${state.maxPrompt}`]);
  if(state.maxOutput) pairs.push(["COPILOT_PROVIDER_MAX_OUTPUT_TOKENS", kind==="ps" ? `'${state.maxOutput}'` : `${state.maxOutput}`]);
  return pairs;
}

// :824-830
function genShellAlias(){
  const name = state.aliasName || "cc";
  const body = envPairs("shell").map(([k,v]) => `${k}=${v}`).join(" ");
  return `alias ${name}='${body} copilot${flagsStr()}'`;
}
```

`state.aliasName` 只做空白修剪，`;`、反引號、`{`、`}` 都會原樣進入 `alias ${name}=` 或 `function ${name} {`。

**正確示範（exemplar，照抄這個模式）** — `cursor.html:983-985`：

```js
function posixSingleQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}
```

## 要做的事（依序）

1. 在 `copilot-cli.html` 的 script 區（`OUTPUT GENERATION` 區塊前）加入三個 helper：
   - `function posixSingleQuote(s)` — 逐字照抄 cursor.html 的版本。
   - `function psSingleQuote(s)` — 回傳 `"'" + String(s).replace(/'/g, "''") + "'"`（PowerShell 單引號用雙寫跳脫）。
   - `function safeIdentifier(s, fallback)` — `const m = /^([A-Za-z_][A-Za-z0-9_-]*)$/.exec(String(s||"").trim()); return m ? m[1] : fallback;`
2. `shellKeyValue()`：literal 模式改回 `posixSingleQuote(state.keyLiteral || "YOUR-API-KEY")`；env 模式的變數名過 `safeIdentifier(n, "API_KEY")`。
3. `psKeyValue()`：同上，literal 模式改用 `psSingleQuote(...)`；env 模式變數名過 `safeIdentifier(...)`（`$env:` 前綴保持不變）。
4. `envPairs(kind)`：全部值改經跳脫 helper —
   - shell 分支：`posixSingleQuote(v)` 包住每個字串值（`p.type`、`baseUrl()`、`modelString()`、`wire`）。數字欄位（maxPrompt/maxOutput）先 `Number(...)` 再內插，非數字時略過該 pair。
   - ps 分支：`psSingleQuote(v)` 同上。
5. `genShellAlias()`：改成
   `return \`alias ${safeIdentifier(name, "cc")}=${posixSingleQuote(body + " copilot" + flagsStr())}\`;`
   （整個 body 以 posixSingleQuote 包一次，內部值不再自行加引號 — 由 helper 統一處理。）
6. `genShellFunction()`：函數名過 `safeIdentifier(name, "cc")`；body 內每行維持 `K=V`，V 已由 envPairs 跳脫。
7. `genPwshFunction(...)`：函數名過 `safeIdentifier(name, "cc")`（PowerShell 函數名可再寬鬆，但保守即可）；`$vars` 雜湊的值已由 psSingleQuote 跳脫。
8. **不要**改 `genPwshAliasNote`、collection 邏輯、UI 文字。

## 驗證（done criteria）

- `node --check`（抽出 inline `<script>` 後檢查，作法見計畫 004 的 `scripts/check.js`）通過。
- 用 Node 寫一個一次性 harness（放 `/tmp`，**不要**提交進 repo）：抽出的 script 前面加上 stub
  （`const document = {getElementById: () => null}; const window = {};`、固定 `state`/`PROVIDERS` 值），
  對 `envPairs("shell")`、`genShellAlias()`、`genPwshFunction(false)` 餵入 hostile 值
  （baseUrl=`https://x$(reboot).example`、model=`a'b`、keyLiteral=`x'; reboot #`、aliasName=`cc; reboot`），
  斷言：輸出中不含未跳脫的 `` ` ``、`$( `、裸露的 `'` 提早結束；alias 名稱 fallback 成 `cc`。
- 手動：開啟頁面，用分享連結帶入惡意 baseUrl，確認產生的 alias 片段在 `bash -n`（語法檢查）下可解析且不執行任何指令。

## 邊界

- **只改** `copilot-cli.html`。
- **不要**動其他頁面（cursor/opencode 已正確）、不要動 `storage.js`、不要動 UI 文字與 `?v=`。
- 產生片段的「外觀」可以略微改變（引號樣式），這是可接受的；但 `COPILOT_*` 環境變數名稱與參數集合不可增減。

## 維護注意

- 未來新增任何內嵌使用者值的輸出欄位，必須經過 `posixSingleQuote`／`psSingleQuote`。
- 若之後把 quoting helper 抽到共用檔（例如 storage.js 或 models.js），四個頁面應共用同一份（見計畫 004 的 CI 檢查精神）。

## 逃生口

- 若 `envPairs` 的輸出被 collection 或分享邏輯以「原始字串比對」相依（重構後 code 改變會破壞既有 collection 項目的還原），**停下來回報**，不要自行擴大範圍。