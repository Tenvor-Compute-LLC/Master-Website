// Logo strip names and the hero diagram's rotating step and log lines
// Ecosystem strip: tools that accept any OpenAI-compatible API (base URL + key); a name without a logo shows as text
export const clients: { name: string; logo?: string }[] = [
  ["OpenAI SDK", "openai"], ["LangChain", "langchain"], ["LlamaIndex", "llamaindex"], ["Vercel AI SDK", "vercel"],
  ["LiteLLM"], ["Continue"], ["Cline", "cline"], ["Roo Code"], ["Aider"], ["Zed", "zed"],
  ["JetBrains AI Assistant", "jetbrains"], ["OpenCode"], ["Pi"], ["Open WebUI", "openwebui"], ["LibreChat"],
  ["n8n", "n8n"], ["Dify", "dify"], ["curl"],
].map(([name, file]) => ({ name, logo: file && `/logos/eco/${file}.svg` }));

export const flowSteps = ["Routing to Qwen 3.6 35B", "Matching a free node", "Launching sealed container", "Streaming back · 35+ tok/s", "Receipt · tokens, charge"];

export const flowLogs = ["14:02:11  job.queued  chat-35b-moe", "14:02:14  job.routed  node=n17", "14:02:15  container.sealed  c9f2a", "14:02:17  stream.open  35+ tok/s", "14:02:20  job.done  receipt=itemised"];
