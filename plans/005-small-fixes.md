# 計畫 005 — 小修復包：groq slug、cursor 過時預設、codex catalog 錯誤內容等 7 項

- **來源發現**: TECH-04、TECH-06、CORRECTNESS-03/07/10/13/14
- **嚴重度**: MED（皆為使用者可踩到的實際錯誤）｜**工作量**: S（每項 10-30 分鐘）｜**修法風險**: LOW
- **撰寫時的基準 commit**: `7105c32`

七個彼此獨立的小修復。逐項完成、逐項驗證；任何一項與描述不符就跳過該項並在回報中註記。

---

## 5.1 groq：inline 清單的錯誤 slug + catalog 缺模型（TECH-04）

**現況**：`codex-cli.html:447` groq 清單含 `qwen-3-32b`（無 namespace）與 `moonshotai/kimi-k2-instruct`；
`model-catalog.groq.json` 有 `qwen/qwen3-32b` 但**沒有** kimi-k2-instruct。使用者下載的 catalog 不含 UI 提供的模型。

**做法**：
1. `codex-cli.html:447`：`{id:"qwen-3-32b",eff:"omit"}` → `{id:"qwen/qwen3-32b",eff:"omit"}`。
2. `model-catalog.groq.json`：照現有 entry 結構新增 `moonshotai/kimi-k2-instruct` 的完整 entry
   （欄位與相鄰 entry 一致：`slug`、`display_name`、`description`（`"<slug> via Groq."`）、
   `supported_reasoning_levels`（照相鄰 entry）、`shell_type:"shell_command"`、`visibility:"list"`、
   `supported_in_api:true`、`priority`（照相鄰 entry）、`base_instructions:"You are moonshotai/kimi-k2-instruct running in the Codex CLI through Groq."`、其餘照相鄰 entry）。
   放在 `qwen/qwen3-32b` 之前，維持字母排序。

**驗證**：`python3 -m json.tool model-catalog.groq.json` 通過；新 slug 出現在 catalog 且 inline id 是 catalog 子集（計畫 004 檢查 D 會綠）。

---

## 5.2 cursor.html 過時的 ollama-cloud 預設（TECH-06）

**現況**：`cursor.html:678-687` preset `baseURL: "https://ollama.deepinfra.com/v1"`、`model: "llama-3.1"`。
全站其他地方都是 `https://ollama.com/v1`（models.js、codex-cli :441）。

**做法**：`baseURL` → `"https://ollama.com/v1"`；`model` → `"glm-5.3-flash:cloud"`（models.js 的 defaultModel）。
不改 cursor.html 的其他結構（不在此頁引入 models.js — 留給第二階段）。

**驗證**：grep `deepinfra` 在 cursor.html 為 0 筆；頁面產生的設定含新 baseURL。

---

## 5.3 codex-cli：catalog fetch 失敗時殘留舊 `dataset.raw`（CORRECTNESS-03）

**現況**：`codex-cli.html:838-844`

```js
  } catch(e){
    $("catalogOut").textContent = `// Place model-catalog.${p.modelCatalog}.json in ~/.codex/`;
  }
```

copy/download 按鈕讀 `$("catalogOut").dataset.raw`（:933、:936）— 失敗時殘留**上一個** provider 的內容，
以錯誤檔名下載。另外快速切換 provider 時非同步回傳順序錯亂也可能覆寫。

**做法**：`renderCatalogCode` 開頭 `$("catalogOut").dataset.raw = "";`；catch 分支同樣設空；
加一個呼叫序號（`let catalogSeq = 0;` 每次 +1，回呼比對序號，過期就 return）。

**驗證**：切 groq → 失敗情境（DevTools 把 request 設 blocked）→ copy 按鈕複製的是空字串或提示，不是上一個 provider 的 JSON。

---

## 5.4 cursor.html 複製按鈕缺非安全情境 fallback（CORRECTNESS-10）

**現況**：`cursor.html:1080-1100` 兩個 copy handler 直接 `navigator.clipboard.writeText(...)`，
`file://` 下會 reject 只跳 "copy failed"。其他頁與 `storage.js:158-166` 有 `isSecureContext` + textarea fallback。

**做法**：兩個 handler 改呼叫與其他頁相同的 fallback 模式（先讀 `storage.js:150-170` 的實作；
若該邏輯已是可呼叫的 helper 就直接用，否則在 cursor.html 內複製該小段邏輯，保持檔案自包含風格）。

**驗證**：`open cursor.html`（file://）→ 複製成功且有 toast/文字回饋。

---

## 5.5 i18n：缺 key 時蓋掉頁面既有的 fallback 文字（CORRECTNESS-13）

**現況**：`i18n.js:150-155`

```js
    scope.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.getAttribute("data-i18n");
      if (!key) return;
      element.textContent = t(key);
    });
```

`t()` 找不到翻譯時回傳 key 本身（`i18n.js:92-96`），把作者寫在 HTML 裡的 fallback 文字換成 `codex.brandSubtitle` 這種原始鍵名。

**做法**：改為

```js
      const translated = t(key);
      if (translated !== key) element.textContent = translated;
```

**驗證**：臨時把 markup 的某 `data-i18n` key 改成不存在的鍵 → 載入後顯示原本的 HTML fallback 文字而非鍵名（測完還原）。

---

## 5.6 codex-cli：DEFAULT_STATE.model 未接 registry（CORRECTNESS-14）

**現況**：`codex-cli.html:474` `model:"glm-5.3-flash:cloud"` 寫死，registry 的 `defaultModel` 改了也不會生效。

**做法**：在 `DEFAULT_STATE` 定義之後加：

```js
if (window.BYOK_MODELS && window.BYOK_MODELS.providers["ollama-cloud"]) DEFAULT_STATE.model = window.BYOK_MODELS.providers["ollama-cloud"].defaultModel;
```

**驗證**：改 models.js 的 defaultModel（臨時）→ 頁面初始選取跟著變（測完還原）；`node scripts/check.js` E 項仍綠。

---

## 5.7 claude-code：launch snippet 的 keyEnv 未驗證（CORRECTNESS-07）

**現況**：`claude-code.html:925-928`

```js
    if (state.requireKey && keyEnv && keyEnv !== "ANTHROPIC_API_KEY") {
      parts.push(`export ANTHROPIC_API_KEY="\${${keyEnv}}"`);
```

`keyEnv` 是自由輸入（只 trim），含空格/引號/`$` 會產生損壞的 export 行。

**做法**：產生前以 `/^[A-Za-z_][A-Za-z0-9_]*$/` 驗證，不通過就回退到 `ANTHROPIC_API_KEY`（與 litellm 對 env 名稱的處理一致）。輸入欄位加 `pattern` 屬性與一行 hint 亦可（擇一，至少做 JS 端）。

**驗證**：keyEnv 填 `MY KEY$` → 產生的 snippet 使用 `ANTHROPIC_API_KEY`；填 `MY_KEY` → 正常。

---

## 邊界（整個計畫）

- 只動上述七處；**不要**順手重構、不要動 `models.js` 的資料、不要 bump `?v=`（除非動到 JS 檔內容 — i18n.js 動了就要 bump，見計畫 004 檢查 C）。
- 5.1 的 catalog 修改只新增一個 entry；**不要**「順便」對齊整份 catalog 與 inline 清單（那是 DIR-04 被否決的範圍）。

## 驗證總表

- `node scripts/check.js`（計畫 004 落地後）全綠。
- 每項的個別驗證如上；全部完成後在回報中逐項列出「完成／跳過＋原因」。