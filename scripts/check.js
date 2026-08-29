/* scripts/check.js — BYOK Forge 零依賴靜態檢查（僅用 node 內建模組）。
   檢查項目：JS 語法、i18n 鍵集、?v= 一致性、groq parity、registry 健全性。
   本機執行：node scripts/check.js；GitHub Actions 在 deploy 前執行同一支。 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let failed = false;

function report(label, ok, detail) {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}`);
  if (detail) console.log(detail.replace(/^/gm, '  '));
  if (!ok) failed = true;
}

function listFiles(ext) {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.endsWith(ext))
    .map(d => d.name)
    .sort();
}

function loadInSandbox(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  return ctx.window;
}

/* A. JS 語法：根目錄 *.js 直接解析；*.html 抽出 inline <script>（不含 src=）逐塊解析 */
(function checkJsSyntax() {
  const problems = [];
  let jsCount = 0;
  let inlineCount = 0;
  for (const f of listFiles('.js')) {
    jsCount++;
    try {
      new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
    } catch (e) {
      problems.push(`${f}: ${e.message}`);
    }
  }
  for (const f of listFiles('.html')) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
    let m;
    let idx = 0;
    while ((m = re.exec(src)) !== null) {
      if (/\bsrc\s*=/i.test(m[1])) continue;
      idx++;
      inlineCount++;
      try {
        new vm.Script(m[2], { filename: `${f}#inline-${idx}` });
      } catch (e) {
        problems.push(`${f}（第 ${idx} 個 inline script）：${e.message}`);
      }
    }
  }
  report(`A. JS 語法（${jsCount} 個根目錄 *.js ＋ ${inlineCount} 個 HTML inline script）`,
    problems.length === 0, problems.join('\n'));
})();

/* B. i18n 鍵集 — 各語言鍵集必須與 en 完全對齊（缺鍵／多鍵皆視為失敗，blocking）。 */
(function checkI18nKeys() {
  const label = 'B. i18n 鍵集（I18N_TRANSLATIONS 各語言 vs en）';
  let translations;
  try {
    translations = loadInSandbox('translations.js').I18N_TRANSLATIONS;
  } catch (e) {
    report(label, false, `translations.js 無法載入：${e.message}`);
    return;
  }
  if (!translations || !translations.en) {
    report(label, false, '找不到 window.I18N_TRANSLATIONS.en');
    return;
  }
  const flat = (obj, prefix = '') =>
    Object.keys(obj).flatMap(k =>
      obj[k] && typeof obj[k] === 'object' ? flat(obj[k], `${prefix}${k}.`) : [`${prefix}${k}`]);
  const enKeys = new Set(flat(translations.en));
  const diffs = [];
  for (const lang of Object.keys(translations)) {
    if (lang === 'en') continue;
    const keys = new Set(flat(translations[lang]));
    const missing = [...enKeys].filter(k => !keys.has(k));
    const extra = [...keys].filter(k => !enKeys.has(k));
    if (missing.length || extra.length) diffs.push({ lang, missing, extra });
  }
  if (diffs.length === 0) {
    report(`${label} — ${Object.keys(translations).length} 語言鍵集一致`, true);
    return;
  }
  const lines = [`基準 en：${enKeys.size} 鍵`];
  for (const d of diffs) {
    lines.push(`${d.lang}：缺 ${d.missing.length} 鍵 [${d.missing.slice(0, 5).join(', ')}${d.missing.length > 5 ? ', …' : ''}]` +
      (d.extra.length ? `；多 ${d.extra.length} 鍵 [${d.extra.slice(0, 5).join(', ')}]` : ''));
  }
  report(`${label} — 鍵集未對齊`, false, lines.join('\n'));
})();

/* C. ?v= 一致性：translations/storage/i18n 在所有引用頁面版本相同；
   models.js 在所有引用頁面版本相同且等於檔內 VERSION。 */
(function checkScriptVersions() {
  const byFile = {};
  for (const f of listFiles('.html')) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const [file, query] = m[1].split('?');
      const v = new URLSearchParams(query || '').get('v');
      if (v === null) continue;
      (byFile[path.basename(file)] = byFile[path.basename(file)] || []).push({ page: f, v });
    }
  }
  const problems = [];
  const summary = [];
  for (const base of ['translations.js', 'storage.js', 'i18n.js']) {
    const refs = byFile[base] || [];
    if (refs.length === 0) { problems.push(`${base}：沒有任何頁面引用`); continue; }
    const versions = [...new Set(refs.map(r => r.v))];
    if (versions.length > 1) {
      problems.push(`${base}：?v= 不一致 → ${refs.map(r => `${r.page}?v=${r.v}`).join(', ')}`);
    } else {
      summary.push(`${base} 於 ${refs.length} 頁 = ${versions[0]}`);
    }
  }
  let registryVersion = null;
  try {
    registryVersion = loadInSandbox('models.js').BYOK_MODELS.version;
  } catch (e) {
    problems.push(`models.js 無法載入：${e.message}`);
  }
  const modelRefs = byFile['models.js'] || [];
  if (modelRefs.length === 0) {
    problems.push('models.js：沒有任何頁面引用');
  } else {
    const versions = [...new Set(modelRefs.map(r => r.v))];
    if (versions.length > 1) {
      problems.push(`models.js：?v= 不一致 → ${modelRefs.map(r => `${r.page}?v=${r.v}`).join(', ')}`);
    } else if (registryVersion !== null && versions[0] !== String(registryVersion)) {
      problems.push(`models.js：頁面 ?v=${versions[0]} ≠ 檔內 VERSION=${registryVersion}`);
    } else {
      summary.push(`models.js 於 ${modelRefs.length} 頁 = ${versions[0]}（= VERSION）`);
    }
  }
  report('C. ?v= 一致性（translations/storage/i18n 各頁相同；models.js 各頁相同且 = VERSION）',
    problems.length === 0, problems.join('\n') || summary.join('；'));
})();

/* D. groq parity：codex-cli.html groq provider 的 models id 必須都存在於 catalog */
(function checkGroqParity() {
  const problems = [];
  let slugs = new Set();
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'model-catalog.groq.json'), 'utf8'));
    slugs = new Set(catalog.models.map(m => m.slug));
  } catch (e) {
    problems.push(`model-catalog.groq.json 無法解析：${e.message}`);
  }
  const html = fs.readFileSync(path.join(ROOT, 'codex-cli.html'), 'utf8');
  const line = html.split('\n').find(l => l.includes('moonshotai/kimi-k2-instruct'));
  let ids = [];
  if (!line) {
    problems.push('codex-cli.html 找不到 groq provider 行（錨點：moonshotai/kimi-k2-instruct）');
  } else {
    const m = line.match(/models:\s*\[([^\]]*)\]/);
    if (!m) {
      problems.push('groq provider 行找不到 models:[...] 清單');
    } else {
      ids = [...m[1].matchAll(/id\s*:\s*["']([^"']+)["']/g)].map(x => x[1]);
      if (ids.length === 0) problems.push('groq models:[...] 內沒有解析到任何 id');
      const unknown = ids.filter(id => !slugs.has(id));
      if (unknown.length) problems.push(`inline groq models 內不在 catalog 的 id：${unknown.join(', ')}`);
    }
  }
  report('D. groq parity（codex-cli groq models ⊆ model-catalog.groq.json）',
    problems.length === 0,
    problems.join('\n') || `${ids.length} 個 id 全部存在於 catalog（共 ${slugs.size} 個 slug）：${ids.join(', ')}`);
})();

/* E. registry 健全性：ollama-cloud 21 筆、首位 priority=100、其餘 20、id 依字母排序 */
(function checkRegistry() {
  const label = 'E. registry 健全性（BYOK_MODELS.providers["ollama-cloud"]）';
  let models;
  try {
    models = loadInSandbox('models.js').BYOK_MODELS.providers['ollama-cloud'].models;
  } catch (e) {
    report(label, false, `models.js 無法載入：${e.message}`);
    return;
  }
  if (!Array.isArray(models)) { report(label, false, 'models 不是陣列'); return; }
  const problems = [];
  if (models.length !== 21) problems.push(`models 共 ${models.length} 筆，預期 21`);
  const first = models[0] || {};
  if (first.id !== 'glm-5.3-flash:cloud') problems.push(`第一筆 id=${first.id}，預期 glm-5.3-flash:cloud`);
  if (first.priority !== 100) problems.push(`第一筆 priority=${first.priority}，預期 100`);
  models.slice(1).forEach((m, i) => {
    if (m.priority !== 20) problems.push(`第 ${i + 2} 筆（${m.id}）priority=${m.priority}，預期 20`);
  });
  const restIds = models.slice(1).map(m => m.id);
  const sortedIds = [...restIds].sort();
  restIds.forEach((id, i) => {
    if (id !== sortedIds[i]) problems.push(`id 未依字母排序：第 ${i + 2} 筆是 ${id}，應為 ${sortedIds[i]}`);
  });
  report(label, problems.length === 0,
    problems.join('\n') ||
    `共 ${models.length} 筆；首位 ${first.id}（priority=100）；其餘 priority=20 且 id 依字母排序`);
})();

console.log(failed ? '\ncheck：有檢查失敗，詳情如上。' : '\ncheck：全部通過。');
process.exit(failed ? 1 : 0);