/* =========================================================================
   BYOK Forge — shared model registry (single source of truth)

   All tool pages (codex-cli / copilot-cli / claude-code / opencode / cursor /
   litellm) derive their Ollama Cloud and OpenRouter model lists from here.
   Bump VERSION whenever model data changes so persisted page snapshots are
   refreshed on next load. Cache-bust with ?v= equal to VERSION when loading
   this file.
   ========================================================================= */
(function () {
  const VERSION = 20260830;

  const ollamaCloudModels = [
    { id: "glm-5.3-flash",              name: "GLM 5.3 Flash",              context: 1048552, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 100 },
    { id: "deepseek-v4-flash:0731",     name: "DeepSeek V4 Flash",          context: 1048576, output: 65536,   efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "deepseek-v4-pro:0813",       name: "DeepSeek V4 Pro",            context: 1048576, output: 65536,   efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gemma4",                     name: "Gemma 4",                    context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "gemma4:31b",                 name: "Gemma 4 31B",                context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "glm-5.1",                    name: "GLM 5.1",                    context: 202752,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "glm-5.2",                    name: "GLM 5.2",                    context: 1000000, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "glm-5.3",                    name: "GLM 5.3",                    context: 1048552, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gpt-oss:120b",               name: "gpt-oss 120B",               context: 131072,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gpt-oss:20b",                name: "gpt-oss 20B",                context: 131072,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "kimi-k2.6",                  name: "Kimi K2.6",                  context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "kimi-k2.7-code",             name: "Kimi K2.7 Code",             context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "kimi-k3",                    name: "Kimi K3",                    context: 1048434, output: 1048576, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "minimax-m2.7",               name: "MiniMax M2.7",               context: 196608,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "minimax-m3",                 name: "MiniMax M3",                 context: 1048576, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "mistral-large-3:675b",       name: "Mistral Large 3 675B",       context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-nano:30b",        name: "Nemotron 3 Nano 30B",        context: 262144,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-super",           name: "Nemotron 3 Super",           context: 262144,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-ultra",           name: "Nemotron 3 Ultra",           context: 262144,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "qwen3.5",                    name: "Qwen3.5",                    context: 258048,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "qwen3.5:397b",               name: "Qwen3.5 397B",               context: 258048,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
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
          { id: "deepseek/deepseek-v4-flash",    name: "DeepSeek V4 Flash",          context: 1048576, output: 65536,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "xiaomi/mimo-v2.5",              name: "Xiaomi MiMo v2.5",           context: 1048576, output: 65536,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "minimax/minimax-m3",            name: "MiniMax M3",                 context: 1048576, output: 512000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "tencent/hy3-preview",           name: "Tencent Hy3 preview",        context: 262144,  output: 65536,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "z-ai/glm-5.2",                  name: "Z.ai GLM 5.2",               context: 1000000, output: 65536,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "anthropic/claude-opus-4.7",     name: "Anthropic Claude Opus 4.7",  context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "deepseek/deepseek-v4-pro",      name: "DeepSeek V4 Pro",            context: 1048576, output: 384000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "anthropic/claude-opus-4.8",     name: "Anthropic Claude Opus 4.8",  context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "anthropic/claude-sonnet-4.6",   name: "Anthropic Claude Sonnet 4.6",context: 1000000, output: 128000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
          { id: "stepfun/step-3.7-flash",        name: "StepFun Step 3.7 Flash",     context: 256000,  output: 256000, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
        ],
      },
    },
  };
})();