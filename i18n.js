(function (global) {
  "use strict";

  const STORAGE_KEY = "byok-forge-lang";
  const DEFAULT_LANG = "zh-Hant";
  const FONT_LINK_IDS = {
    "zh-Hant": "byok-font-noto-tc",
    "zh-Hans": "byok-font-noto-sc",
    ja: "byok-font-noto-jp",
    ko: "byok-font-noto-kr",
    th: "byok-font-noto-thai",
  };
  const FONT_URLS = {
    "zh-Hant": "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap",
    "zh-Hans": "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
    ja: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap",
    ko: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap",
    th: "https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700&display=swap",
  };

  const LANGS = global.I18N_LANGUAGES || {};
  const TRANSLATIONS = global.I18N_TRANSLATIONS || {};

  const state = {
    currentLang: DEFAULT_LANG,
    page: null,
    titleKey: null,
    onChange: null,
    loadedFonts: new Set(),
  };

  function normalizeLang(code) {
    if (!code) return DEFAULT_LANG;
    const raw = String(code).trim();
    if (!raw) return DEFAULT_LANG;
    const lower = raw.toLowerCase();
    if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg" || lower === "zh-hans" || lower === "zh-hans-cn" || lower === "zh-hans-sg") return "zh-Hans";
    if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo" || lower === "zh-hant" || lower === "zh-hant-tw" || lower === "zh-hant-hk" || lower === "zh-hant-mo") return "zh-Hant";
    if (lower.startsWith("ja")) return "ja";
    if (lower.startsWith("ko")) return "ko";
    if (lower.startsWith("vi")) return "vi";
    if (lower.startsWith("th")) return "th";
    if (lower.startsWith("id")) return "id";
    if (lower.startsWith("de")) return "de";
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("es")) return "es";
    if (lower.startsWith("en")) return "en";
    return DEFAULT_LANG;
  }

  function getStoredLang() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function getBrowserLang() {
    const list = global.navigator && Array.isArray(global.navigator.languages) ? global.navigator.languages : [];
    for (const item of list) {
      const lang = normalizeLang(item);
      if (lang in LANGS) return lang;
    }
    if (global.navigator && global.navigator.language) {
      const match = normalizeLang(global.navigator.language);
      if (match in LANGS) return match;
    }
    return DEFAULT_LANG;
  }

  function detectLang() {
    const stored = normalizeLang(getStoredLang());
    if (stored in LANGS) return stored;
    return getBrowserLang();
  }

  function getLangMeta(lang) {
    return LANGS[lang] || LANGS[DEFAULT_LANG] || {};
  }

  function getMessage(lang, key) {
    const langDict = TRANSLATIONS[lang] || {};
    const fallbackDict = TRANSLATIONS.en || {};
    const parts = String(key).split(".");
    let current = langDict;
    let currentFallback = fallbackDict;
    for (const part of parts) {
      current = current && typeof current === "object" ? current[part] : undefined;
      currentFallback = currentFallback && typeof currentFallback === "object" ? currentFallback[part] : undefined;
      if (current === undefined && currentFallback === undefined) {
        return undefined;
      }
    }
    if (current !== undefined) return current;
    return currentFallback;
  }

  function interpolate(text, vars) {
    if (!text) return "";
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (match, key) {
      return vars[key] !== undefined ? String(vars[key]) : match;
    });
  }

  function t(key, vars) {
    const resolved = getMessage(state.currentLang, key) || getMessage(DEFAULT_LANG, key) || getMessage("en", key) || key;
    return interpolate(resolved, vars);
  }

  function ensureFontLink(lang) {
    const meta = getLangMeta(lang);
    if (!meta || !meta.fontHref || state.loadedFonts.has(lang)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = meta.fontHref;
    link.id = FONT_LINK_IDS[lang] || `byok-font-${lang}`;
    document.head.appendChild(link);
    state.loadedFonts.add(lang);
  }

  function applyFont(lang) {
    const meta = getLangMeta(lang);
    const value = meta && meta.fontStack ? meta.fontStack : "";
    document.documentElement.style.setProperty("--cjk", value);
    ensureFontLink(lang);
  }

  function setLang(lang, options) {
    const normalized = normalizeLang(lang);
    const target = normalized in LANGS ? normalized : DEFAULT_LANG;
    state.currentLang = target;
    try {
      localStorage.setItem(STORAGE_KEY, target);
    } catch (err) {
      // ignore storage failures
    }
    document.documentElement.lang = target;
    applyFont(target);
    applyTranslations(document.documentElement);
    updateSwitcher();
    updateTitle();
    if (state.onChange) {
      state.onChange(target, options || {});
    }
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang: target } }));
  }

  function applyTranslations(root) {
    const scope = root || document.documentElement;
    scope.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.getAttribute("data-i18n");
      if (!key) return;
      element.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (element) {
      const key = element.getAttribute("data-i18n-html");
      if (!key) return;
      element.innerHTML = t(key);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(function (element) {
      const attrData = element.getAttribute("data-i18n-attr") || "";
      attrData.split(";").forEach(function (pair) {
        const trimmed = pair.trim();
        if (!trimmed) return;
        const [attr, key] = trimmed.split(":");
        if (!attr || !key) return;
        element.setAttribute(attr.trim(), t(key.trim()));
      });
    });
  }

  function updateSwitcher() {
    const root = document.getElementById("langSwitcher");
    if (!root) return;
    const current = state.currentLang;
    const select = root.querySelector("select");
    if (select) {
      select.value = current;
      select.setAttribute("aria-label", t("common.languageSwitcherAria"));
      return;
    }
    const label = document.createElement("label");
    label.className = "lang-switch";
    label.innerHTML = '<select class="lang-select" aria-label="Language"></select>';
    root.appendChild(label);
    const selectEl = label.querySelector("select");
    Object.keys(LANGS).forEach(function (key) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = LANGS[key].nativeLabel;
      selectEl.appendChild(option);
    });
    selectEl.value = current;
    selectEl.addEventListener("change", function (event) {
      const next = event.target.value;
      setLang(next);
    });
    applyTranslations(root);
  }

  function updateTitle() {
    const key = state.titleKey || (state.page ? state.page + ".title" : null);
    if (!key) return;
    document.title = t(key);
  }

  function init(options) {
    state.page = options && options.page ? options.page : (document.body && document.body.getAttribute("data-page")) || "index";
    state.titleKey = options && options.titleKey ? options.titleKey : null;
    state.onChange = options && options.onChange ? options.onChange : null;
    const initialLang = detectLang();
    setLang(initialLang, { initial: true });
  }

  global.I18NEngine = {
    init: init,
    setLang: setLang,
    detectLang: detectLang,
    t: t,
    applyTranslations: applyTranslations,
    updateSwitcher: updateSwitcher,
  };
  global.t = t;
  global.setLang = setLang;
  global.detectLang = detectLang;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (!state.page) {
        init({ page: document.body && document.body.getAttribute("data-page") || "index" });
      }
    });
  } else if (!state.page) {
    init({ page: document.body && document.body.getAttribute("data-page") || "index" });
  }
})(window);
