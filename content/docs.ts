// Text of https://tenvor.io/docs (checked 2026-11-20), word for word. Inline runs: string, { code }, or { href, text }.
export type Rich = (string | { code: string } | { href: string; text: string })[];
export type NavLink = { href: string; label: string };

const T = "https://tenvor.io";

export const docsHead = {
  kicker: "For developers",
  title: "Documentation",
  intro: "Tenvor is an OpenAI-compatible API for open models. These pages take you from a new account to a reply with its receipt, and then to your tools, your limits and your balance.",
  actions: [
    { href: "/docs/quickstart", label: "Make your first request" },
    { href: "#works", label: "See what works today" },
  ],
};

export const toc: NavLink[] = [
  { href: "#start", label: "Start here" },
  { href: "#how", label: "How a request runs" },
  { href: "#at-a-glance", label: "The API at a glance" },
  { href: "#works", label: "What works today" },
  { href: "#integrations", label: "Connect a tool" },
  { href: "#reference", label: "Reference" },
  { href: "#alpha", label: "The alpha, in short" },
];

// The source sidebar ("Documentation"); every entry is a page on this site.
export const guides: { group?: string; links: NavLink[] }[] = [
  { links: [{ href: "/docs", label: "Overview" }] },
  { group: "Start", links: [{ href: "/docs/quickstart", label: "First request" }] },
  { group: "Connect a tool", links: [
    { href: "/docs/integrations/pi", label: "Pi" },
    { href: "/docs/integrations/opencode", label: "OpenCode" },
    { href: "/docs/integrations/jetbrains", label: "JetBrains" },
  ] },
  { group: "Reference", links: [
    { href: "/docs/api/chat-completions", label: "Chat Completions" },
    { href: "/docs/models-and-limits", label: "Models and limits" },
    { href: "/docs/billing", label: "Billing and receipts" },
    { href: "/docs/troubleshooting", label: "Troubleshooting" },
  ] },
];

export const start = {
  intro: "Five steps from nothing to a reply. The first request guide walks through each one.",
  steps: [
    { title: "Sign up", body: ["No card is needed, and a new account starts with $0.25 of free credit."] },
    { title: "Create an API key", body: ["In the ", { href: `${T}/console`, text: "Console" }, ", on the API keys page. The key is shown once."] },
    { title: "Set your key and change the base URL", body: ["Keep your OpenAI SDK. Point it at ", { code: "https://orchestrator.tenvor.io/v1" }, " and read the key from ", { code: "TENVOR_API_KEY" }, "."] },
    { title: "Send one request", body: ["Python, Node and curl samples are in ", { href: "/docs/quickstart#send", text: "the guide" }, "."] },
    { title: "Read the response and its receipt", body: ["Every request that completes has an itemised receipt: tokens in, tokens out and the charge."] },
  ] as { title: string; body: Rich }[],
};

export const how = [
  "You send a request. Tenvor routes it to the node best suited for it, among the nodes that have the model loaded. The node runs it in a sealed container with no internet access, and the answer comes back with an itemised receipt.",
  "A node is a GPU machine on the network, run by one of Tenvor's operators, tested and enrolled before it gets work.",
];

export const glance: { k: string; v: Rich }[] = [
  { k: "Base URL", v: [{ code: "https://orchestrator.tenvor.io/v1" }] },
  { k: "Chat", v: [{ code: "POST /v1/chat/completions" }] },
  { k: "Models you can use", v: [{ code: "GET /v1/models" }] },
  { k: "Key", v: ["Starts with ", { code: "sk-dc-" }, ". Created in the Console."] },
  { k: "Variable in our samples", v: [{ code: "TENVOR_API_KEY" }] },
  { k: "Model", v: [{ code: "chat-35b-moe" }] },
];
export const glanceNote: Rich = ["The live prices and the model's limits are on ", { href: "/pricing", text: "Pricing" }, " and ", { href: "/models", text: "Models" }, ". These pages do not repeat them."];

export const works = {
  yes: [
    ["Chat completions"],
    ["System, user and assistant messages"],
    ["Streaming"],
    ["Function tools, run by your code"],
    [{ code: "temperature" }, ", ", { code: "top_p" }, ", ", { code: "stop" }, ", ", { code: "max_tokens" }],
    ["Idempotency keys"],
    ["Usage and charge for every request"],
    ["JSON mode, structured output and sampler controls"],
    [{ code: "reasoning_effort" }, " thinking levels, with the thinking returned as ", { code: "reasoning_content" }],
  ] as Rich[],
  no: ["Image input", "Embeddings", "Audio"],
  note: "Unsupported fields are refused. Accepted fields with no effect are named in X-Tenvor-Ignored-Parameters.",
  more: { href: "/docs/api/chat-completions", text: "Read the Chat Completions reference" },
};

export type DocCard = { href: string; title: string; body: string };
export const integrations = {
  intro: "Use a synthetic or non-sensitive project to try a coding tool. It sends your files, terminal output and chat history to a node.",
  cards: [
    { href: "/docs/quickstart#send", title: "OpenAI SDKs", body: "Python and Node. Change the base URL and keep your code." },
    { href: "/docs/integrations/pi", title: "Pi", body: "Our recommended coding tool. Set up with one command." },
    { href: "/docs/integrations/opencode", title: "OpenCode", body: "Set up with a one-line installer. Every tool call asks first." },
    { href: "/docs/integrations/jetbrains", title: "JetBrains AI Assistant", body: "Add Tenvor as an OpenAI-compatible provider." },
  ] as DocCard[],
};

export const reference: DocCard[] = [
  { href: "/docs/api/chat-completions", title: "Chat Completions", body: "The request, the response, streaming, tools and errors." },
  { href: "/docs/models-and-limits", title: "Models and limits", body: "The model, and where to read its live limits." },
  { href: "/docs/billing", title: "Billing and receipts", body: "Read a receipt, and what a held amount is." },
  { href: "/docs/troubleshooting", title: "Troubleshooting", body: "What each error means, and what to do next." },
];

export const alpha = {
  points: [
    "Capacity is limited, and there is no uptime or latency SLA.",
    "Your request runs in a sealed container with no internet access. That is sandboxing, not encryption: requests are not yet cryptographically protected on the node that runs them. Use Tenvor for work that is not sensitive.",
    "If a request fails on a node before any output is sent, Tenvor may retry it once on another node, if one is free. You are not charged for the attempt that failed. If a request fails on a node after output has started, you are not charged and it is not retried. A request that you cancel, or that stops at your own output limit, can be charged for its input and the output it generated. Requests are never logged or kept. A request's content and files are erased when it finishes.",
  ],
  links: [
    { href: "/trust", label: "Trust page" },
    { href: "/legal/privacy", label: "Privacy policy" },
    { href: "/legal/public-alpha-risk", label: "Alpha risk notice" },
  ] as NavLink[],
};

export const reviewNote: Rich = ["Content checked 2026-10-19. ", { href: "/models", text: "Live limits" }, " and ", { href: "/pricing", text: "prices" }, " can change."];
export const next = { href: "/docs/quickstart", label: "First request" };
