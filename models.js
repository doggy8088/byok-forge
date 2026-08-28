/* =========================================================================
   BYOK Forge — shared model registry (single source of truth)

   All tool pages (codex-cli / copilot-cli / claude-code / opencode) derive
   their Ollama Cloud model lists from here. Bump VERSION whenever model
   data changes so persisted page snapshots are refreshed on next load.
   Cache-bust with ?v= equal to VERSION when loading this file.
   ========================================================================= */
(function () {
  const VERSION = 20260829;

  const ollamaCloudModels = [
    { id: "glm-5.3-flash:cloud",        name: "GLM 5.3 Flash Cloud",        context: 1048552, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 100 },
    { id: "deepseek-v4-flash:cloud",    name: "DeepSeek V4 Flash Cloud",    context: 1048576, output: 65536,   efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "deepseek-v4-pro:cloud",      name: "DeepSeek V4 Pro Cloud",      context: 1048576, output: 65536,   efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gemma4:31b-cloud",           name: "Gemma 4 31B Cloud",          context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "gemma4:cloud",               name: "Gemma 4 Cloud",              context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "glm-5.1:cloud",              name: "GLM 5.1 Cloud",              context: 202752,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "glm-5.2:cloud",              name: "GLM 5.2 Cloud",              context: 1000000, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "glm-5.3:cloud",              name: "GLM 5.3 Cloud",              context: 1048552, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gpt-oss:120b-cloud",         name: "gpt-oss 120B Cloud",         context: 131072,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "gpt-oss:20b-cloud",          name: "gpt-oss 20B Cloud",          context: 131072,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "kimi-k2.6:cloud",            name: "Kimi K2.6 Cloud",            context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "kimi-k2.7-code:cloud",       name: "Kimi K2.7 Code Cloud",       context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "kimi-k3:cloud",              name: "Kimi K3 Cloud",              context: 1048434, output: 1048576, efforts: ["low", "medium", "high"], codexEff: "high", priority: 20 },
    { id: "minimax-m2.7:cloud",         name: "MiniMax M2.7 Cloud",         context: 196608,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "minimax-m3:cloud",           name: "MiniMax M3 Cloud",           context: 1048576, output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "mistral-large-3:675b-cloud", name: "Mistral Large 3 675B Cloud", context: 262144,  output: 262144,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-nano:30b-cloud",  name: "Nemotron 3 Nano 30B Cloud",  context: 262144,  output: 131072,  efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-super:cloud",     name: "Nemotron 3 Super Cloud",     context: 262144,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "nemotron-3-ultra:cloud",     name: "Nemotron 3 Ultra Cloud",     context: 262144,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "qwen3.5:397b-cloud",         name: "Qwen3.5 397B Cloud",         context: 258048,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
    { id: "qwen3.5:cloud",              name: "Qwen3.5 Cloud",              context: 258048,  output: 65536,   efforts: ["low", "medium", "high"], codexEff: "omit", priority: 20 },
  ];

  window.BYOK_MODELS = {
    version: VERSION,
    providers: {
      "ollama-cloud": {
        baseUrl: "https://ollama.com/v1",
        keyEnv: "OLLAMA_API_KEY",
        defaultModel: "glm-5.3-flash:cloud",
        models: ollamaCloudModels,
      },
    },
  };
})();