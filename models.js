/* =========================================================================
   BYOK Forge — shared model registry (single source of truth)

   All tool pages (codex-cli / copilot-cli / claude-code / opencode / cursor /
   litellm / pi / omp / minimax-code) derive their Ollama Cloud and OpenRouter
   model lists from here.
   Bump VERSION whenever model data changes so persisted page snapshots are
   refreshed on next load. Cache-bust with ?v= equal to VERSION when loading
   this file.

   Data sources (2026-11-17):
   - ollama-cloud: model list, vision/thinking/tools and context_length from the
     Ollama Cloud API (GET https://ollama.com/api/tags, POST /api/show; models
     without "tools" are excluded). reasoningEfforts / reasoningDefault /
     reasoningCanDisable come from /api/show "thinking" ({values, default}).
     Output limits and temperature support come from models.dev (the API has none).
   - openrouter: curated ids; context, max output, input modalities, reasoning
     and temperature from GET https://openrouter.ai/api/v1/models;
     reasoningEfforts from models.dev.

   Field notes:
   - efforts / codexEff: generic levels consumed by copilot-cli / codex-cli.
   - input: native input modalities ("text", "image", "video", "pdf", "audio").
   - reasoningEfforts: effort values the model accepts ([] = on/off only).
   - reasoningDefault: provider default effort (string), on/off default
     (boolean), or null when the API does not say.
   ========================================================================= */
(function () {
  const VERSION = 20261117;

  const ollamaCloudModels = [
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 100, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "max", reasoningCanDisable: false, temperature: true },
    { id: "beam", name: "Beam 1.0", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["low", "medium", "high", "xhigh", "max"], reasoningDefault: "max", reasoningCanDisable: false, temperature: true },
    { id: "deepseek-v4-pro:0813", name: "DeepSeek V4 Pro", context: 1048576, output: 65536, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "low", reasoningCanDisable: true, temperature: true },
    { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", context: 1048576, output: 384000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "high", reasoningCanDisable: true, temperature: true },
    { id: "deepseek-v4.1-flash:1017", name: "DeepSeek V4.1 Flash 1017", context: 1048576, output: 384000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "high", reasoningCanDisable: true, temperature: true },
    { id: "gemma4:31b", name: "Gemma 4 31B", context: 262144, output: 262144, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: false, reasoningCanDisable: true, temperature: true },
    { id: "glm-5.2", name: "GLM 5.2", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["high", "max"], reasoningDefault: "high", reasoningCanDisable: true, temperature: true },
    { id: "glm-5.3", name: "GLM 5.3", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "max", reasoningCanDisable: false, temperature: true },
    { id: "gpt-oss:120b", name: "gpt-oss 120B", context: 131072, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["low", "medium", "high"], reasoningDefault: "medium", reasoningCanDisable: false, temperature: true },
    { id: "gpt-oss:20b", name: "gpt-oss 20B", context: 131072, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["low", "medium", "high"], reasoningDefault: "medium", reasoningCanDisable: false, temperature: true },
    { id: "inkling-2-small", name: "Inkling 2 Small", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "medium", "high", "max"], reasoningDefault: "high", reasoningCanDisable: true, temperature: true },
    { id: "kimi-k2.6", name: "Kimi K2.6", context: 262144, output: 262144, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: true },
    { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", context: 262144, output: 262144, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: false },
    { id: "kimi-k3", name: "Kimi K3", context: 1048576, output: 1048576, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "high", "max"], reasoningDefault: "max", reasoningCanDisable: true, temperature: false },
    { id: "kimi-k3.1-pro", name: "Kimi K3.1 Pro", context: 1048576, output: 1048576, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "medium", "high", "max"], reasoningDefault: "max", reasoningCanDisable: true, temperature: false },
    { id: "mimo-v2.6-flash", name: "MiMo V2.6 Flash", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: true },
    { id: "mimo-v2.6-pro", name: "MiMo V2.6 Pro", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: true },
    { id: "minimax-m3", name: "MiniMax M3", context: 512000, output: 131072, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
    { id: "minimax-m3.1-flash", name: "MiniMax M3.1 Flash", context: 1000000, output: 512000, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
    { id: "mistral-large-4", name: "Mistral Large 4", context: 1048576, output: 262144, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: [], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
    { id: "muse-spark-open", name: "Muse Spark Open", context: 1048576, output: 131072, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image"], reasoning: true, reasoningEfforts: ["low", "medium", "high", "xhigh"], reasoningDefault: "xhigh", reasoningCanDisable: true, temperature: true },
    { id: "nemotron-3-super", name: "Nemotron 3 Super", context: 262144, output: 65536, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: true },
    { id: "nemotron-3-ultra", name: "Nemotron 3 Ultra", context: 262144, output: 128000, efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: [], reasoningDefault: true, reasoningCanDisable: true, temperature: true },
  ];

  window.BYOK_MODELS = {
    version: VERSION,
    providers: {
      "ollama-cloud": {
        baseUrl: "https://ollama.com/v1",
        keyEnv: "OLLAMA_API_KEY",
        defaultModel: "glm-5.3-flash",
        models: ollamaCloudModels,
      },
      "openrouter": {
        baseUrl: "https://openrouter.ai/api/v1",
        keyEnv: "OPENROUTER_API_KEY",
        defaultModel: "deepseek/deepseek-v4-flash",
        models: [
          { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", context: 1048576, output: 393216, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["none", "high", "xhigh"], reasoningDefault: null, reasoningCanDisable: true, temperature: true },
          { id: "xiaomi/mimo-v2.5", name: "Xiaomi MiMo v2.5", context: 1000000, output: 65536, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "video", "audio"], reasoning: true, reasoningEfforts: [], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
          { id: "minimax/minimax-m3", name: "MiniMax M3", context: 1048576, output: 512000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "video"], reasoning: true, reasoningEfforts: [], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
          { id: "tencent/hy3-preview", name: "Tencent Hy3 preview", context: 262144, output: 235929, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["none", "low", "high"], reasoningDefault: null, reasoningCanDisable: true, temperature: true },
          { id: "z-ai/glm-5.2", name: "Z.ai GLM 5.2", context: 1048576, output: 943718, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["none", "high", "xhigh"], reasoningDefault: null, reasoningCanDisable: true, temperature: true },
          { id: "anthropic/claude-opus-4.7", name: "Anthropic Claude Opus 4.7", context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "pdf"], reasoning: true, reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"], reasoningDefault: null, reasoningCanDisable: true, temperature: false },
          { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", context: 1048576, output: 393216, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text"], reasoning: true, reasoningEfforts: ["none", "high", "xhigh"], reasoningDefault: null, reasoningCanDisable: true, temperature: true },
          { id: "anthropic/claude-opus-4.8", name: "Anthropic Claude Opus 4.8", context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "pdf"], reasoning: true, reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"], reasoningDefault: null, reasoningCanDisable: true, temperature: false },
          { id: "anthropic/claude-sonnet-4.6", name: "Anthropic Claude Sonnet 4.6", context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "pdf"], reasoning: true, reasoningEfforts: ["none", "low", "medium", "high", "max"], reasoningDefault: null, reasoningCanDisable: true, temperature: true },
          { id: "stepfun/step-3.7-flash", name: "StepFun Step 3.7 Flash", context: 262144, output: 230400, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20, input: ["text", "image", "video"], reasoning: true, reasoningEfforts: ["low", "medium", "high"], reasoningDefault: null, reasoningCanDisable: false, temperature: true },
        ],
      },
    },
  };
})();
