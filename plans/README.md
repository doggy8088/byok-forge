# plans — byok-forge 改善計畫索引

- **基準 commit**: `7105c32`（每份計畫檔頭均標記；executor 執行前先用 `git log --oneline -1` 比對，落後過多先回報 drift）
- **產出方式**: `/improve` 標準流程 — 4 個平行唯讀子代理審計（correctness+performance、security、architecture/DX/tests、docs/direction），主代理逐項開檔核實後擇優成計畫。
- **非互動預設**: 本輪執行時使用者不在場，已依 skill 規則撰寫** leverage 前 5 名**的計畫（001-005）；未入選項目完整列於下方，待使用者勾選後補寫。

## 狀態表

| 計畫 | 主題 | 嚴重度 | 工作量 | 狀態 |
|---|---|---|---|---|
| 001 | copilot-cli 產生輸出的 shell/PowerShell 跳脫（RCE） | HIGH | S-M | DONE（`5040b9f`，worktree `improve/001-shell-escaping`，已審核 APPROVE） |
| 002 | 各頁 innerHTML XSS 跳脫 | HIGH | S-M | DONE（`677987a`，worktree `improve/002-xss-escaping`，已審核 APPROVE） |
| 003 | keyLiteral 不外流 + 分享/匯入驗證 + 版本升級合併 | HIGH | M | DONE（`32955e4`，worktree `improve/003-state-hardening`，REVISE 1 輪後 APPROVE） |
| 004 | CI 驗證基線（scripts/check.js + check job） | MED | S | DONE（`5356d76`，worktree `improve/004-ci-baseline`，已審核 APPROVE；B 項依逃生口降級 report-only） |
| 005 | 小修復包（7 項獨立小錯） | MED | S | DONE（`9cde297`，worktree `improve/005-small-fixes`，已審核 APPROVE） |

## 建議執行順序與依賴

```
005 (小修復包) ──→ 004 (CI 基線) ──→ 001 ──→ 002 ──→ 003
```

- **005 → 004**：CI 的 groq parity 檢查（004-D）假設 5.1 的 slug 修正已落地，否則紅燈（預期）。
- **004 → 001/002/003**：三份安全計畫的驗證都使用 `scripts/check.js` 的語法檢查；先有基線再動手。
- **001 與 002 可平行**（不同函式群），003 依賴 002 的 `BYOKEsc`（003-D 用到跳脫 helper）。
- 003 的 mergeProviders 是第二階段（registry 擴及全部 provider）的前置。

## 審計發現總表（已核實；v = 已驗證證據）

| # | 發現 | 類別 | 影響 | 工作量 | 風險 | 證據 | 狀態 |
|---|---|---|---|---|---|---|---|
| 1 | copilot-cli 產生的 shell/PS 片段未跳脫使用者值（`$(...)`、引號、alias 名注入）；分享連結自動採用惡意值 → 貼入 rc 檔後 RCE | security | HIGH | S-M | LOW | copilot-cli.html:775-845（v） | → 001 |
| 2 | innerHTML 未跳脫渲染 provider/collection 名稱與顏色；分享連結載入即觸發 | security | HIGH | S-M | LOW | copilot-cli.html:914-919、1233-1243 等 7 檔（v） | → 002 |
| 3 | keyLiteral 明文進 localStorage 與 `#cfg=` 分享 URL，違反「金鑰不離開頁面」承諾 | security | HIGH | S | LOW | copilot-cli.html:418/725/740-747/1305-1311（v） | → 003 |
| 4 | 分享/匯入零驗證（`__proto__`、無大小上限、任意 JSON 當 page 合併）＋ modelsVersion 守衛被分享連結毒化 ＋ 版本升級整份丟棄自訂 provider | security+correctness | MED-HIGH | M | MED | copilot-cli.html:1320-1333（v）、storage.js:196-206（v） | → 003 |
| 5 | 無任何驗證基線：無測試/lint/typecheck，deploy 直接上傳；近期手修 bug 全可被靜態檢查攔截 | DX | MED | S | LOW | deploy.yml:22-35（v） | → 004 |
| 6 | groq inline 清單 slug 錯（`qwen-3-32b` 應為 `qwen/qwen3-32b`）＋ catalog 缺 kimi-k2-instruct（下載物缺 UI 模型） | correctness | MED | S | LOW | codex-cli.html:447、model-catalog.groq.json（v） | → 005.1 |
| 7 | cursor.html ollama-cloud 預設指向 dead 端點 `ollama.deepinfra.com` + 不存在的 `llama-3.1` | tech-debt | MED | S | LOW | cursor.html:678-687（v） | → 005.2 |
| 8 | codex catalog fetch 失敗殘留舊 `dataset.raw` → copy/download 吐前一個 provider 的內容 | correctness | MED | S | LOW | codex-cli.html:838-844（v） | → 005.3 |
| 9 | cursor.html 複製按鈕在 file:// 下必敗（無 isSecureContext fallback） | correctness | MED | S | LOW | cursor.html:1080-1100（v） | → 005.4 |
| 10 | i18n 缺 key 時以原始鍵名蓋掉 HTML 內的 fallback 文字 | correctness | LOW-MED | S | LOW | i18n.js:150-155（v） | → 005.5 |
| 11 | codex DEFAULT_STATE.model 寫死，未接 registry defaultModel | correctness | LOW-MED | S | LOW | codex-cli.html:474（v） | → 005.6 |
| 12 | claude-code launch snippet 的 keyEnv 未驗證（空格/`$` 產生損壞 export） | correctness | LOW-MED | S | LOW | claude-code.html:925-931（v） | → 005.7 |
| 13 | collection 永久保存生成時的 code，registry bump 後「全部複製」吐過時 alias | correctness | LOW-MED | S | LOW | copilot-cli.html:1299-1312 | → 003.E |
| 14 | README「self-contained HTML」已失真、無 models.js 維護慣例說明、claude-code 章節過簡、meta description 漏 3 個工具 | docs | MED | S | LOW | README.md:8/29-32/135-142 | 未入選（見下） |
| 16 | **新發現（執行 004 時由 check.js 揪出）**：i18n 鍵集漂移 — en 有 361 鍵，9 個語言（zh-Hans/ja/ko/vi/th/id/de/fr/es）各缺 52 鍵（`cursor.*` 48 鍵＋`index.cardCursor*` 4 鍵）；僅 zh-Hant 與 en 完整 | docs | MED | S | LOW | scripts/check.js B 項（`5356d76`），已獨立驗證 | 未規劃（建議下一輪補計畫：補譯 52 鍵後將 B 轉為 blocking） |
| 15 | 模型清單以 5 種方言重複：OpenRouter（codex 10 項 vs cursor 10 項 vs litellm 3 項，已漂移）、OpenAI、Ollama-local、Groq、xAI、vLLM、DeepSeek | tech-debt | MED | L | MED | codex-cli.html:427/453、cursor.html:703-714、litellm.html:321-336（v） | 未入選（見 Direction） |

### 審計後否決（不要重審）

- **groq catalog 對齊機制**（原 DIR-04）：單一 beta 供應商、catalog 即交付物；修 005.1 + 004-D 的 parity 檢查已足夠。
- **效能類發現**（每次按鍵全量 refresh + innerHTML 重建）：21 選項規模下無可感知延遲，低於回報門檻。
- **README 供應商數量**：抽查 copilot-cli 14 個、litellm 14 個、codex 10 個皆正確（DOCS-03 不成立）。
- **cursor/litellm 缺 modelsVersion 守衛**：真實但屬 TECH-08/15 第二階段重構的一部分，單獨修會在重構時重做。

## Direction（產品方向選項，非 bug）

1. **模型資料同步自動化（建議先做 spike）**：最近 6 個 commit 全是手動模型資料維護。做一個排程 GitHub Action 偵測 ollama.com 雲端清單與 `models.js` 的差異、自動開 issue（先不自動寫檔 — 上游無穩定 JSON API，爬 HTML 較脆）。工作量 M，先驗證偵測可行再談自動化。
2. **第二階段 registry 統一**：把 OpenRouter（重複度最高、已漂移）→ OpenAI → 其餘供應商逐一搬進 models.js；litellm 的 plain-string 清單需先決定是否帶 limit metadata。依賴 004 的 CI 基線。
3. **分享連結推廣到其他 4 頁**：copilot-cli 已有完整 `#cfg=` 模式，cursor/claude/opencode/litellm 使用者每次換機要重選 provider/model。機制已在 repo 內，S-M。前提：先落地 003 的消毒，否則是把攻擊面複製到更多頁。
4. **translations.js 拆檔**（每語言一檔）：目前 3,743 行單體、11 語言鍵集完全一致（已驗證），僅在編輯頻率上升時才有價值 — 現階段**不建議**，004-B 的鍵集檢查已擋住主要風險。

## 給 executor 的共同規則

- 每份計畫自包含；執行前先 `git log --oneline -1` 確認 drift（基準 `7105c32`）。
- 完成每份計畫後更新本表的狀態欄（TODO → DONE，附 commit sha）；受阻改 BLOCKED 並寫明原因。
- 本 repo 的驗證入口是計畫 004 的 `node scripts/check.js`；落地前以「抽出 inline script + `node --check`」替代。
- 一律遵循 repo 慣例：繁中 commit（`fix(scope): 描述`）、共用檔載入需 `?v=`、零 npm 依賴。