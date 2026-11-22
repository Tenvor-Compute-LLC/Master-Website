export type Integration = { name: string; logo: string; brand: string };

// Tools that accept an OpenAI-compatible API: set the base URL and key, and they run on Tenvor.
const list: [string, string, string][] = [
  ["OpenAI SDK", "openai", "#10a37f"],
  ["LangChain", "langchain", "#1c9c8c"],
  ["LlamaIndex", "llamaindex", "#bc8deb"],
  ["Vercel AI SDK", "vercel", "#ffffff"],
  ["CrewAI", "crewai", "#ff5a50"],
  ["Dify", "dify", "#3b6bff"],
  ["n8n", "n8n", "#ea4b71"],
  ["Make", "make", "#a42be3"],
  ["Cursor", "cursor", "#ffffff"],
  ["GitHub Copilot", "copilot", "#8957e5"],
  ["Cline", "cline", "#ffffff"],
  ["Zed", "zed", "#3b82f6"],
  ["JetBrains", "jetbrains", "#fe315d"],
  ["Open WebUI", "openwebui", "#ffffff"],
  ["LobeChat", "lobechat", "#ffb02e"],
  ["Raycast", "raycast", "#ff6363"],
];

export const integrations: Integration[] = list.map(([name, file, brand]) => ({ name, logo: `/logos/eco/${file}.svg`, brand }));
