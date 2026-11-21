export type Service = { icon: string; title: string; body: string; scope: string; price: string };

export const services: Service[] = [
  { icon: "svc-workflow", title: "OpenAI-Compatible API", body: "Swap the base URL and keep your SDK. Streaming, function tools and reasoning work as before, with a receipt on every request.", scope: "Chat completions · Streaming · Function tools · Reasoning", price: "$0.126/1M in" },
  { icon: "svc-strategy", title: "Routing & Failover", body: "Each request goes to the node best suited for it. If a node drops before any output, another takes over, and a failed request costs nothing.", scope: "Node scoring · One retry · Signed results", price: "Included" },
  { icon: "svc-sealed", title: "Sealed Containers", body: "Each request runs rootless with no network and reads only model files. Sealed, not encrypted: no sensitive data in alpha.", scope: "No network · Rootless · Read-only weights · Pinned runtime", price: "Included" },
  { icon: "svc-copilots", title: "Chat & Work", body: "A browser workspace on Qwen 3.6 35B. Chat searches the web and reads pages; Work also runs Python on your files and hands back results.", scope: "Web search · File uploads (never kept) · Python sandbox · Spend caps", price: "~$0.0002/msg" },
  { icon: "svc-agents", title: "Coding Agents", body: "OpenCode and Pi set up in one line; JetBrains AI and any OpenAI client connect with a key. Billed per token, no subscription.", scope: "OpenCode · Pi · JetBrains AI · OpenAI SDKs · curl", price: "$0.81/1M out" },
  { icon: "svc-gpu", title: "Run a Node", body: "Have an NVIDIA card with 10 GB+? Tenvor Node tests your PC, serves requests in a sealed container, and pauses when you need it.", scope: "Win 11 & Linux · 10 GB+ VRAM · Invite only · Alpha", price: "Invite only" },
];
