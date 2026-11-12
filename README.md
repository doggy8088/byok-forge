# BYOK Forge

A tiny toolkit of **single-file web tools** that generate *bring-your-own-key* launch
configs for AI coding CLIs. Pick a provider and model, tweak a few options, and copy a
ready-to-paste config. Everything runs locally in the browser — your API keys are
referenced by environment-variable name and never leave the page.

## Pages

| File | Tool | Output |
|------|------|--------|
| [`index.html`](index.html) | **Landing / hub** | Links to all generators |
| [`copilot-cli.html`](copilot-cli.html) | **Copilot Alias Forge** | Shell / PowerShell launch aliases for the GitHub Copilot CLI |
| [`codex-cli.html`](codex-cli.html) | **Codex Config Forge** | `~/.codex/<profile>.config.toml` profiles for the OpenAI Codex CLI |
| [`chatgpt-desktop.html`](chatgpt-desktop.html) | **ChatGPT Desktop Config Forge** | `config.toml`, model profile and `model_catalog.json` for ChatGPT Desktop |
| [`litellm.html`](litellm.html) | **LiteLLM Config Forge** | `litellm-config.yaml` proxy that exposes `/v1/responses` for chat-only providers |
| [`opencode.html`](opencode.html) | **OpenCode Config Forge** | `~/.config/opencode/opencode.json` BYOK config for OpenCode |
| [`cursor.html`](cursor.html) | **Cursor Config Forge** | Cursor `settings.json` BYOK settings reference |
| [`pi.html`](pi.html) | **Pi Config Forge** | `~/.pi/agent/models.json` BYOK config for the Pi coding agent |
| [`omp.html`](omp.html) | **OMP Config Forge** | `~/.omp/agent/models.yml` BYOK config for OMP |
| [`minimax-code.html`](minimax-code.html) | **MiniMax Code Config Forge** | `~/.minimax/config.yaml` BYOK config & `mcode provider add` CLI snippet for MiniMax Code (`mcode`) |

## Usage

Open `index.html` in any browser — no build step, no install, no server.

```bash
open index.html      # macOS
# or double-click the file
```

Each tool is a self-contained HTML file; you can also open `copilot-cli.html`,
`codex-cli.html`, `chatgpt-desktop.html`, `litellm.html`, `opencode.html`, `claude-code.html`,
`cursor.html`, `pi.html`, `omp.html`, or `minimax-code.html` directly, or host the folder on any
static web server.

## Internationalization

The UI is available in Traditional Chinese, Simplified Chinese, Japanese, Korean, Vietnamese,
Thai, English, Indonesian, German, French, and Spanish. The language switcher sits in the
upper-right corner of each page, remembers your choice in `localStorage`, auto-detects the
browser language on first visit, and falls back to Traditional Chinese. The CJK/Thai fonts use
open-source Noto Sans families so Chinese/Japanese/Korean/Thai text renders cleanly while the
existing Latin font stack stays unchanged.

---

## copilot-cli.html — Copilot Alias Forge

Generates **GitHub Copilot CLI launch aliases** that wire up the `COPILOT_PROVIDER_*`
environment variables for any BYOK provider.

- **14 providers** — OpenAI, Azure OpenAI, Anthropic, Google Gemini, Mistral, Ollama
  (local & cloud), OpenRouter, Groq, xAI Grok, DeepSeek, Together, Fireworks, Cerebras.
- **Cascading options** — picking a provider auto-fills `COPILOT_PROVIDER_TYPE`, base URL,
  and API-key field; picking a model pre-fills `COPILOT_PROVIDER_MAX_PROMPT_TOKENS` /
  `COPILOT_PROVIDER_MAX_OUTPUT_TOKENS`, the wire API, and the reasoning-effort levels.
- **Four output shapes** — Shell *alias*, Shell *function* (`"$@"` forwarding), PowerShell
  *function* (with `try/finally` env cleanup), and a PowerShell *alias* explainer.
- **Collection** — build a set of aliases (e.g. `cc` / `cx` / `c4`) and copy them all at once.

**Where to put it:** add the snippet to `~/.bashrc` / `~/.zshrc` (then `source`), or to your
PowerShell `$PROFILE` (then restart PowerShell).

---

## codex-cli.html — Codex Config Forge

Generates **OpenAI Codex CLI BYOK profiles**. Output comes in three parts:

1. A **`[model_providers.<id>]` block** to append to `~/.codex/config.toml` (skipped for
   built-in providers like `ollama` / `lmstudio` / `openai`).
2. A downloadable **`~/.codex/<profile>.config.toml`** profile file (model, provider,
   reasoning effort, approval policy, sandbox mode).
3. The matching **launch command**, e.g. `codex -p ollama-glm-5-2 --yolo`.

- **Responses-API providers only** — OpenAI, Azure OpenAI, Ollama (local & cloud),
  LM Studio, Groq, vLLM, OpenRouter, xAI, and generic *Custom* endpoints all speak
  `/v1/responses` directly.
- Handles Azure's `base_url` (`…/openai`, no `/v1`) + required `query_params` api-version,
  deployment-name-as-model, and keyless local providers.

> Codex no longer supports `wire_api = "chat"` (verified in the `openai/codex` source), so
> Chat-Completions-only providers **cannot** be added as native providers. To use one, run a
> local proxy with the **[LiteLLM Config Forge](litellm.html)** and add it here as a *Custom*
> provider pointing at the proxy.

**Where to put it:** save the downloaded file into `~/.codex/`, append the provider block to
`~/.codex/config.toml`, `export` the referenced API-key env var, then run `codex -p <profile>`.

---

## chatgpt-desktop.html — ChatGPT Desktop Config Forge

Generates a dedicated **ChatGPT Desktop BYOK configuration** without mixing the provider
into the Codex CLI generator. The reference-compatible output includes:

1. A **`config.toml`** entry file with the selected model, provider, Responses API and
   reasoning settings.
2. A **`<model>.config.toml`** model profile.
3. A downloadable **`model_catalog.json`** containing the supplied Duotify model catalog.

The default preset uses provider ID `duotify`, the four `duotify-dev` models, the supplied
LiteLLM base URL and `DUOTIFY_LITELLM_API_KEY`. Provider details and the model remain
editable. Save all generated files in the same ChatGPT Desktop profile directory, export the
referenced key environment variable, and restart ChatGPT Desktop to reload the configuration.

---

## litellm.html — LiteLLM Config Forge

Builds a multi-model **`litellm-config.yaml`** for a local [LiteLLM](https://docs.litellm.ai/docs/response_api)
proxy. The proxy exposes an OpenAI-compatible `/v1/responses` endpoint and auto-bridges to
Chat Completions, so **chat-only providers become usable from any Responses-API client**
(Codex CLI, Copilot CLI, …). Output comes in three parts:

1. The **`litellm-config.yaml`** (a `model_list` of routed models) — copy or download.
2. The **run commands** — `pip install "litellm[proxy]"`, the `export …` lines for the keys
   it needs, and `litellm --config litellm-config.yaml --port 4000`.
3. A ready-to-paste **`[model_providers.litellm]` block** to wire the proxy into Codex.

- **14 providers** — Mistral, DeepSeek, Anthropic, Google Gemini, Cerebras, Together,
  Fireworks, Groq, OpenAI, OpenRouter, xAI, Azure OpenAI, Ollama (local), vLLM.
- **Multi-model** — add as many model entries as you like; each picks a provider, model,
  alias (`model_name`), and key env var. Azure adds `api_base` + `api_version`; local
  providers (Ollama) are keyless with an `api_base`.
- **Proxy settings** — port, optional `master_key`, and `drop_params` to silently drop
  unsupported params when bridging.

**Where to put it:** save `litellm-config.yaml` anywhere, `export` the referenced key env
vars, start the proxy, then point Codex (or any client) at `http://localhost:<port>/v1`.

---

## opencode.html — OpenCode Config Forge

Generates **OpenCode BYOK config** (`opencode.json`) and a companion shell snippet.
Output includes:

1. A top-level `model` value (`<provider-id>/<model>`).
2. A `provider` block with `npm`, `name`, `options`, and per-model settings.
3. A runnable snippet that writes `opencode.json`, exports `OPENCODE_CONFIG`, and optionally
   sets the chosen key env var.

- **Provider presets** — OpenAI, Anthropic, OpenRouter, DeepSeek, Gemini, Ollama, and custom.
- **Model presets + manual input** — preset models are prefilled; you can replace with custom
  IDs and still keep manual limit/name settings.

**Where to put it:** write the JSON to `~/.config/opencode/opencode.json` (or set
`OPENCODE_CONFIG` to a custom path), then run OpenCode from terminal.

## claude-code.html — Claude Code Config Forge

Generates **Claude Code BYOK settings** (`settings.json`) and a companion shell snippet.
Output includes:

1. A full `settings` JSON payload with `model`, `env.ANTHROPIC_BASE_URL`, and runtime-only
   placeholders.
2. A ready-to-run snippet that writes `~/.claude/settings.json` and sets the runtime
   `ANTHROPIC_API_KEY` mapping.

- **BYOK compatibility** — provider URL and model selector for Anthropic-compatible and custom endpoints.
- **Shell-first flow** — copy config JSON and a launch snippet, then run immediately.

## cursor.html — Cursor Config Forge

Generates **Cursor BYOK-oriented settings snippets** and a companion shell command.

- **Provider presets** — OpenAI, OpenRouter, DeepSeek, Ollama Cloud, and custom entry.
- **Multiple schema modes** — choose between Cursor settings key formats used in different releases.
- **Model as hint** — include model id in generated snippets for manual confirmation in Cursor.
- **Key safety** — generated references keep key usage by variable name (no secret values).

## pi.html — Pi Config Forge

Generates **Pi coding agent BYOK config** (`~/.pi/agent/models.json`) for
[pi.dev](https://pi.dev/). Output includes:

1. A `providers` object with `baseUrl`, `api`, and an optional `apiKey`
   (`$ENV_VAR` / `${ENV_VAR}` interpolation, literal, or the `ollama` placeholder).
2. One model entry with `id`, `name`, `reasoning`, `contextWindow`, and `maxTokens`.
3. A launch snippet: `pi --provider <id> --model <model>`.

- **Four API wires** — `openai-completions`, `openai-responses`,
  `anthropic-messages`, `google-generative-ai`.
- **Provider presets** — OpenAI (Chat + Responses), Anthropic (proxy), Google AI
  Studio, OpenRouter, Ollama (local & cloud), LM Studio, vLLM, and custom.
- **Hot reload** — Pi re-reads `models.json` every time you open `/model`, so no
  restart is needed after writing the file.

**Where to put it:** save as `~/.pi/agent/models.json`, `export` the referenced
API-key env var, then run `pi --model <providerId>/<modelId>` or select the model
with `/model`.

## omp.html — OMP Config Forge

Generates **OMP BYOK config** (`~/.omp/agent/models.yml`) for [omp.sh](https://omp.sh/).
Output includes:

1. A `providers` block with `baseUrl`, `api`, `apiKey` (env-var-name-or-literal,
   `!command`, or `auth: none` for keyless), optional `authHeader`, and
   optional `disableStrictTools`.
2. One model entry with `id`, `name`, `reasoning`, `contextWindow`, and `maxTokens`.
3. A launch snippet: `omp --model <providerId>/<modelId>` plus `omp models` to verify.

- **Four API wires** — same as Pi plus OMP-specific defaults (Ollama local preset
  uses `openai-responses` per OMP's implicit discovery behavior).
- **Auth modes** — env-var-name-or-literal `apiKey`, or keyless `auth: none` for
  local engines; optional `authHeader: true` for bearer-token proxies.
- **new-api / one-api presets** — `discovery.type: proxy` option noted for
  Anthropic+OpenAI-compatible proxies.

**Where to put it:** save as `~/.omp/agent/models.yml` (or `models.yaml`), set the
referenced key env var (shell or `.env`), then run `omp --model <providerId>/<modelId>`
and verify with `omp models`.

## minimax-code.html — MiniMax Code Config Forge

Generates **MiniMax Code CLI (`@minimax-ai/code` · `mcode`) BYOK config** (`~/.minimax/config.yaml`)
and a companion `mcode provider add` CLI snippet. Output includes:

1. A `custom_provider.<id>` YAML block with `name`, `kind: custom`, `enabled: true`, `api`,
   `options` (`baseURL`, `authMode: api-key`, `apiKey: ${ENV_VAR}`), and `models.<model-id>`
   (`name`, `configuration_source: manual`, `enabled: true`, `reasoning`, `limit.context`,
   `limit.output`, `capabilities.support_image`), plus optional top-level
   `defaultModel: custom_provider:<id>/<model-id>`.
2. A CLI snippet with `mcode provider add` (`--name`, `--base-url`, `--api-format`, `--model`,
   `--api-key-env`, `--context-limit`, `--output-limit`, `--support-image`, `--use`), plus
   `mcode provider test` and `mcode -m custom_provider:<id>/<model-id>`.

- **Four API formats** — `anthropic-messages`, `openai-completions`, `openai-responses`,
  `google-generative-ai`.
- **Provider presets** — OpenRouter, MiniMax API (`https://api.minimax.io/anthropic`), Anthropic,
  OpenAI, Google Gemini, DeepSeek, Ollama (local & cloud), LM Studio, vLLM, and custom.
- **Secret-free config** — `options.apiKey` uses `${ENV_VAR}` syntax, which `mcode` resolves from
  `process.env` at runtime without storing plaintext secrets on disk.

**Where to put it:** save as `~/.minimax/config.yaml` (or `$MINIMAX_DATA_DIR/config.yaml`) or run
the generated `mcode provider add` command, then launch with `mcode -m custom_provider:<id>/<model>`.

---

## Notes & accuracy

- Keys are referenced by **environment-variable name** (e.g. `$OLLAMA_API_KEY`); generated
  configs contain references, not secrets.
- Model names and token/limit defaults are **best-effort (mid-2026)** and fully editable in
  the UI. Verify against `copilot --help` / `codex --help` and your provider's docs.
