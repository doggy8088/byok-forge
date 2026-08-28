/**
 * BYOK Forge Core Library (storage.js)
 * Provides unified persistence, import/export, lossless URL sharing, modal, and toast capabilities.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "byok_forge_store_v1";

  // Share payload limits (SEC-06): deserialized JSON <= 1 MiB, raw #cfg= param <= 64 KiB
  const MAX_DESERIALIZED_CHARS = 1024 * 1024;
  const MAX_SHARE_PARAM_CHARS = 64 * 1024;
  // Keys that must never survive sanitization (prototype pollution)
  const UNSAFE_KEYS = ["__proto__", "constructor", "prototype"];

  // Base64URL encoding/decoding
  function bytesToBase64Url(bytes) {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function base64UrlToBytes(str) {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Recursive clone dropping prototype-pollution keys
  function cleanDeep(value) {
    if (Array.isArray(value)) return value.map(cleanDeep);
    if (!value || typeof value !== "object") return value;
    const out = {};
    Object.keys(value).forEach((key) => {
      if (UNSAFE_KEYS.indexOf(key) !== -1) return;
      out[key] = cleanDeep(value[key]);
    });
    return out;
  }

  // Lossless compression using browser CompressionStream with fallback
  const BYOKShare = {
    async compress(dataObj) {
      const jsonStr = JSON.stringify(dataObj);
      if (typeof CompressionStream !== "undefined") {
        try {
          const blob = new Blob([jsonStr], { type: "text/plain" });
          const stream = blob.stream().pipeThrough(new CompressionStream("deflate-raw"));
          const compressedBuffer = await new Response(stream).arrayBuffer();
          return "z." + bytesToBase64Url(new Uint8Array(compressedBuffer));
        } catch (e) {
          console.warn("CompressionStream failed, falling back to raw Base64Url", e);
        }
      }
      // Fallback: UTF-8 -> Base64URL
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonStr);
      return "r." + bytesToBase64Url(bytes);
    },

    async decompress(encodedStr, opts) {
      if (!encodedStr || typeof encodedStr !== "string") return null;
      if (encodedStr.length > MAX_SHARE_PARAM_CHARS) return null;
      try {
        if (encodedStr.startsWith("z.")) {
          const raw = encodedStr.slice(2);
          const bytes = base64UrlToBytes(raw);
          if (typeof DecompressionStream !== "undefined") {
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
            const text = await new Response(stream).text();
            if (text.length > MAX_DESERIALIZED_CHARS) return null;
            return this.sanitize(JSON.parse(text), opts);
          }
        } else if (encodedStr.startsWith("r.")) {
          const raw = encodedStr.slice(2);
          const bytes = base64UrlToBytes(raw);
          const decoder = new TextDecoder();
          const text = decoder.decode(bytes);
          if (text.length > MAX_DESERIALIZED_CHARS) return null;
          return this.sanitize(JSON.parse(text), opts);
        } else {
          // Try raw base64 or deflate-raw directly
          try {
            const bytes = base64UrlToBytes(encodedStr);
            if (typeof DecompressionStream !== "undefined") {
              const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
              const text = await new Response(stream).text();
              if (text.length > MAX_DESERIALIZED_CHARS) return null;
              return this.sanitize(JSON.parse(text), opts);
            }
          } catch (err) {
            const bytes = base64UrlToBytes(encodedStr);
            const decoder = new TextDecoder();
            const text = decoder.decode(bytes);
            if (text.length > MAX_DESERIALIZED_CHARS) return null;
            return this.sanitize(JSON.parse(text), opts);
          }
        }
      } catch (err) {
        console.error("Failed to decompress state from URL hash", err);
        return null;
      }
      return null;
    },

    async getSharedData(opts) {
      const hash = window.location.hash || "";
      const match = hash.match(/[#&]cfg=([^&]+)/);
      if (match && match[1]) {
        if (match[1].length > MAX_SHARE_PARAM_CHARS) return null;
        return this.sanitize(await this.decompress(decodeURIComponent(match[1]), opts), opts);
      }
      return null;
    },

    // Sanitize untrusted share/import payloads. strictState drops non-primitive
    // state values (pages with flat state opt in); default keeps nested values
    // (e.g. litellm state.entries) but still proto-cleans and size-caps them.
    sanitize(data, opts) {
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const cleaned = cleanDeep(data);
      if (Array.isArray(cleaned.providers)) {
        cleaned.providers = cleaned.providers.filter((p) =>
          p && typeof p === "object" && !Array.isArray(p) &&
          typeof p.id === "string" && typeof p.name === "string"
        );
        cleaned.providers.forEach((p) => {
          if (!Array.isArray(p.models)) p.models = [];
        });
      }
      if (opts && opts.strictState === true &&
          cleaned.state && typeof cleaned.state === "object" && !Array.isArray(cleaned.state)) {
        const st = {};
        Object.keys(cleaned.state).forEach((k) => {
          const v = cleaned.state[k];
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") st[k] = v;
        });
        cleaned.state = st;
      }
      return cleaned;
    },

    async shareCurrentPage(pageData, toastMsg) {
      try {
        const compressed = await this.compress(pageData);
        const url = new URL(window.location.href);
        url.hash = "cfg=" + encodeURIComponent(compressed);
        const shareUrl = url.toString();
        await this.copyToClipboard(shareUrl);
        BYOKToast.show(toastMsg || (window.t ? window.t("common.shareCopied") : "Share link copied to clipboard!"));
        return shareUrl;
      } catch (err) {
        console.error("Error creating share link", err);
        BYOKToast.show("Failed to copy link");
      }
    },

    copyToClipboard(text) {
      return new Promise((resolve) => {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(resolve).catch(() => {
            this.fallbackCopy(text);
            resolve();
          });
        } else {
          this.fallbackCopy(text);
          resolve();
        }
      });
    },

    fallbackCopy(text) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        console.error("ExecCommand copy failed", e);
      }
      document.body.removeChild(ta);
    },
  };

  // Unified Local Storage Manager
  const BYOKStore = {
    getAll() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) || {};
        }
      } catch (e) {
        console.error("Failed to read from localStorage", e);
      }
      return {};
    },

    saveAll(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error("Failed to save to localStorage", e);
      }
    },

    getPage(pageId, defaultData) {
      const all = this.getAll();
      const pageData = all.pages && all.pages[pageId];
      if (!pageData) {
        return defaultData ? JSON.parse(JSON.stringify(defaultData)) : null;
      }
      return pageData;
    },

    savePage(pageId, pageData) {
      const all = this.getAll();
      if (!all.pages) all.pages = {};
      all.pages[pageId] = pageData;
      all.updatedAt = new Date().toISOString();
      this.saveAll(all);
    },

    // defaults: fresh list derived from the registry (array or object map)
    // saved: user-persisted list
    // ids present in defaults win (registry is authoritative); ids missing from
    // defaults (user-created providers) are kept from saved.
    mergeProviders(defaults, saved) {
      const isArray = Array.isArray(defaults);
      const defIds = new Set(isArray ? defaults.map(p => p.id) : Object.keys(defaults));
      const extra = isArray
        ? (saved || []).filter(p => p && !defIds.has(p.id))
        : Object.fromEntries(Object.entries(saved || {}).filter(([k]) => !defIds.has(k)));
      return isArray ? defaults.concat(extra) : Object.assign({}, defaults, extra);
    },

    exportBackup() {
      const all = this.getAll();
      const exportObj = {
        version: "1.0",
        app: "byok-forge",
        exportedAt: new Date().toISOString(),
        pages: all.pages || {},
      };
      const jsonStr = JSON.stringify(exportObj, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const fileName = `byok-forge-backup-${dateStr}.json`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      BYOKToast.show(window.t ? window.t("common.exportSuccess") : "Settings exported!");
    },

    importBackup(file, onSuccess, onError) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Invalid format");
          }
          if (!(parsed.pages && typeof parsed.pages === "object" && !Array.isArray(parsed.pages))) {
            throw new Error("Invalid format: missing pages object");
          }
          const all = this.getAll();
          if (!all.pages) all.pages = {};
          Object.keys(parsed.pages).forEach((pageId) => {
            if (UNSAFE_KEYS.indexOf(pageId) !== -1) return;
            const cleaned = BYOKShare.sanitize(parsed.pages[pageId]);
            if (cleaned) all.pages[pageId] = cleaned;
          });
          all.updatedAt = new Date().toISOString();
          this.saveAll(all);
          BYOKToast.show(window.t ? window.t("common.importSuccess") : "Settings imported successfully!");
          if (onSuccess) onSuccess(all);
        } catch (err) {
          console.error("Import error", err);
          BYOKToast.show(window.t ? window.t("common.importError") : "Failed to import settings");
          if (onError) onError(err);
        }
      };
      reader.onerror = () => {
        BYOKToast.show(window.t ? window.t("common.importError") : "Failed to read file");
        if (onError) onError(new Error("File read error"));
      };
      reader.readAsText(file);
    },
  };

  // Toast Notification
  const BYOKToast = {
    timer: null,
    show(message, duration) {
      let toastEl = document.getElementById("toast");
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.id = "toast";
        toastEl.className = "toast";
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = message;
      toastEl.classList.add("show");
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        toastEl.classList.remove("show");
      }, duration || 2000);
    },
  };

  // Common Modal Helper
  const BYOKModal = {
    show(options) {
      const existing = document.getElementById("byok-modal-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "byok-modal-overlay";
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(10, 11, 14, 0.82);
        backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; box-sizing: border-box; opacity: 0;
        transition: opacity .2s ease;
      `;

      const dialog = document.createElement("div");
      dialog.style.cssText = `
        background: var(--panel, #13151c);
        border: 1px solid var(--border-2, #323848);
        border-radius: var(--radius, 14px);
        width: 100%; max-width: 520px;
        max-height: 90vh; overflow-y: auto;
        box-shadow: 0 28px 70px -20px rgba(0,0,0,0.9);
        display: flex; flex-direction: column;
        color: var(--text, #e9e7e0);
        font-family: var(--sans, system-ui, sans-serif);
      `;

      const header = document.createElement("div");
      header.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px; border-bottom: 1px solid var(--border, #262b37);
        background: #0d0f14;
      `;
      const titleEl = document.createElement("h3");
      titleEl.style.cssText = "margin:0; font-family:var(--display, monospace); font-size:16px; font-weight:700; color:var(--text, #fff);";
      titleEl.textContent = options.title || "Add Provider";
      header.appendChild(titleEl);

      const closeBtn = document.createElement("button");
      closeBtn.id = "byok-modal-close";
      closeBtn.style.cssText = "background:transparent; border:none; color:var(--muted, #888); font-size:18px; cursor:pointer; padding:4px 8px; border-radius:6px;";
      closeBtn.textContent = "✕";
      header.appendChild(closeBtn);

      const body = document.createElement("div");
      body.style.cssText = "padding: 20px; display:flex; flex-direction:column; gap: 14px;";

      (options.fields || []).forEach((f) => {
        const fieldWrap = document.createElement("div");
        fieldWrap.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
        const label = document.createElement("label");
        label.style.cssText = "font-family: var(--mono, monospace); font-size: 11.5px; font-weight: 600; color: var(--muted, #888); text-transform: uppercase; letter-spacing: 0.05em;";
        label.textContent = f.label;
        fieldWrap.appendChild(label);

        if (f.type === "select") {
          const select = document.createElement("select");
          select.id = "bm-" + f.id;
          select.style.cssText = "width:100%; background:var(--bg, #0a0b0e); color:var(--text, #fff); font-family:var(--mono, monospace); font-size:13px; border:1px solid var(--border-2, #323848); border-radius:8px; padding:9px 12px; outline:none;";
          (f.options || []).forEach((opt) => {
            const o = document.createElement("option");
            o.value = typeof opt === "object" ? opt.value : opt;
            o.textContent = typeof opt === "object" ? opt.label : opt;
            if (o.value === f.value) o.selected = true;
            select.appendChild(o);
          });
          fieldWrap.appendChild(select);
        } else if (f.type === "checkbox") {
          const checkLabel = document.createElement("label");
          checkLabel.style.cssText = "display:flex; align-items:center; gap:8px; cursor:pointer; font-family:var(--mono, monospace); font-size:12.5px; color:var(--text, #fff);";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.id = "bm-" + f.id;
          input.checked = !!f.value;
          input.style.cssText = "cursor:pointer; width:16px; height:16px;";
          checkLabel.appendChild(input);
          const span = document.createElement("span");
          span.textContent = f.checkboxLabel || f.label;
          checkLabel.appendChild(span);
          fieldWrap.appendChild(checkLabel);
        } else {
          const input = document.createElement("input");
          input.type = f.type || "text";
          input.id = "bm-" + f.id;
          input.value = f.value !== undefined ? f.value : "";
          if (f.placeholder) input.placeholder = f.placeholder;
          input.style.cssText = "width:100%; background:var(--bg, #0a0b0e); color:var(--text, #fff); font-family:var(--mono, monospace); font-size:13px; border:1px solid var(--border-2, #323848); border-radius:8px; padding:9px 12px; outline:none; box-sizing:border-box;";
          fieldWrap.appendChild(input);
        }

        if (f.hint) {
          const hint = document.createElement("div");
          hint.style.cssText = "font-size: 11px; color: var(--muted-2, #5d636f); font-family: var(--mono, monospace); white-space: pre-line;";
          hint.textContent = f.hint;
          fieldWrap.appendChild(hint);
        }

        body.appendChild(fieldWrap);
      });

      const footer = document.createElement("div");
      footer.style.cssText = `
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 14px 20px; border-top: 1px solid var(--border, #262b37);
        background: #0d0f14;
      `;
      const cancelBtn = document.createElement("button");
      cancelBtn.id = "byok-modal-cancel";
      cancelBtn.className = "btn";
      cancelBtn.style.cssText = "padding:8px 16px; font-family:var(--mono); font-size:12.5px; border-radius:8px; cursor:pointer; background:transparent; border:1px solid var(--border-2); color:var(--muted);";
      cancelBtn.textContent = "Cancel";
      footer.appendChild(cancelBtn);

      const saveBtn = document.createElement("button");
      saveBtn.id = "byok-modal-save";
      saveBtn.className = "btn primary";
      saveBtn.style.cssText = "padding:8px 18px; font-family:var(--mono); font-size:12.5px; border-radius:8px; cursor:pointer; background:var(--amber, #ffb454); border:none; color:#0a0b0e; font-weight:700;";
      saveBtn.textContent = "Save Provider";
      footer.appendChild(saveBtn);

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(footer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.style.opacity = "1";
      });

      function close() {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 200);
      }

      overlay.querySelector("#byok-modal-close").addEventListener("click", close);
      overlay.querySelector("#byok-modal-cancel").addEventListener("click", close);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });

      const onKeydown = (e) => {
        if (e.key === "Escape") {
          close();
          window.removeEventListener("keydown", onKeydown);
        }
      };
      window.addEventListener("keydown", onKeydown);

      overlay.querySelector("#byok-modal-save").addEventListener("click", () => {
        const values = {};
        (options.fields || []).forEach((f) => {
          const el = document.getElementById("bm-" + f.id);
          if (el) {
            values[f.id] = f.type === "checkbox" ? el.checked : el.value.trim();
          }
        });
        if (options.onSave) {
          const result = options.onSave(values);
          if (result !== false) {
            close();
            window.removeEventListener("keydown", onKeydown);
          }
        }
      });
    },
  };

  // Escape user-controlled values for safe innerHTML interpolation (covers attribute contexts too)
  function escHtml(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

  global.BYOKStore = BYOKStore;
  global.BYOKShare = BYOKShare;
  global.BYOKToast = BYOKToast;
  global.BYOKModal = BYOKModal;
  global.BYOKEsc = { html: escHtml };
})(window);
