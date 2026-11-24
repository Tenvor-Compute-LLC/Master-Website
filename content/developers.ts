// Text of https://tenvor.io/developers (captured 2026-11-20), word for word, split by section.
export const CONSOLE = "https://app.tenvor.io";

export const hero = {
  title: "One API call. Routed to the best machine.",
  lead: "An OpenAI-compatible API for open models. Change the base URL and keep your SDK. You pay per token (roughly, pieces of words) and get an itemised receipt for every request.",
  start: "Live now. No card needed. $0.25 of free credit to start.",
  note: "Here ticket is the text of a support ticket.",
};

export const code: { id: string; label: string; file: string; lines: string[] }[] = [
  { id: "python", label: "Python", file: "change the base URL", lines: [
    "import os",
    "from openai import OpenAI",
    "client = OpenAI(",
    "  base_url=\"https://orchestrator.tenvor.io/v1\",",
    "  api_key=os.environ[\"TENVOR_API_KEY\"],",
    ")",
    "ask = \"Summarise this support ticket in one line.\\n\\n\"",
    "reply = client.chat.completions.create(",
    "  model=\"chat-35b-moe\",",
    "  messages=[{\"role\": \"user\", \"content\": ask + ticket}],",
    ")",
  ] },
  { id: "node", label: "Node", file: "change the base URL", lines: [
    "import OpenAI from \"openai\";",
    "const client = new OpenAI({",
    "  baseURL: \"https://orchestrator.tenvor.io/v1\",",
    "  apiKey: process.env.TENVOR_API_KEY,",
    "});",
    "const ask =",
    "  \"Summarise this support ticket in one line.\\n\\n\";",
    "const reply = await client.chat.completions.create({",
    "  model: \"chat-35b-moe\",",
    "  messages: [{ role: \"user\", content: ask + ticket }],",
    "});",
  ] },
  { id: "curl", label: "curl", file: "change the base URL", lines: [
    "BASE=https://orchestrator.tenvor.io/v1",
    "curl $BASE/chat/completions \\",
    "  -H \"Authorization: Bearer $TENVOR_API_KEY\" \\",
    "  -H \"Content-Type: application/json\" \\",
    "  -d '{",
    "  \"model\": \"chat-35b-moe\",",
    "  \"messages\": [{\"role\": \"user\", \"content\":",
    "  \"Summarise this support ticket in one line.\\n\\n…\"}]",
    "}'",
  ] },
];

/** The receipt for the sample response: [line, tokens, rate, dollars]. */
export const receipt = [
  ["input", "1,180 tokens", "at $0.126 per million", "$0.000149"],
  ["output", "20 tokens", "at $0.81 per million", "$0.000016"],
  ["charged", "", "", "$0.000165"],
];

export const response = {
  node: "A node is a GPU machine on the network, run by one of Tenvor's operators. Tenvor enrols it, and the Tenvor Node app tests it, before it gets any work. Your request runs in a sealed container.",
  every: "Every request gets its own receipt.",
  json: [
    "{",
    "  \"id\": \"chatcmpl-…\",",
    "  \"model\": \"chat-35b-moe\",",
    "  \"choices\": [{ \"message\": {",
    "    \"role\": \"assistant\",",
    "    \"content\": \"Customer was charged twice for one order and wants the second payment refunded.\"",
    "  } }],",
    "  \"usage\": {",
    "    \"prompt_tokens\": 1180,",
    "    \"completion_tokens\": 20,",
    "    \"total_tokens\": 1200",
    "  },",
    "  \"billing\": { \"charged_micro_usd\": 165, … }",
    "}",
  ],
};

export const price = {
  rows: [["$0.126", "per million tokens in"], ["$0.81", "per million tokens out"], ["65,536", "tokens in the context window"]],
  text: "You pay per token (roughly, pieces of words): about 6,000 replies like the sample for $1.",
  plans: "Monthly plans and card payments are not open yet.",
};

export const works = {
  yes: ["Chat completions", "System, user and assistant messages", "Streaming", "Function tools, run by your code", "<code>temperature</code>, <code>top_p</code>, <code>stop</code>, <code>max_tokens</code>", "Idempotency keys", "Usage and charge for every request", "Fetch a result again by its id", "JSON mode, structured output and sampler controls", "<code>reasoning_effort</code> thinking levels, with the thinking returned as <code>reasoning_content</code>"],
  no: ["Image input", "Embeddings", "Audio"],
  note: "A request that uses a control or an input Tenvor does not support is rejected with an error. Accepted fields with no effect are named in X-Tenvor-Ignored-Parameters.",
};

export const tools = [
  { href: "/docs/quickstart", name: "The OpenAI SDKs", text: "Python and Node. Change the base URL." },
  { href: "/docs/integrations/pi", name: "Pi", text: "Our recommended tool. Set up with one command." },
  { href: "/docs/integrations/opencode", name: "OpenCode", text: "Set up with a one-line installer." },
  { href: "/docs/integrations/jetbrains", name: "JetBrains AI Assistant", text: "Add Tenvor as an OpenAI-compatible provider." },
];

export const model = {
  title: "Live now: Qwen 3.6 35B.",
  rows: [["API id", "chat-35b-moe"], ["Weights", "Open, Apache-2.0"], ["Context window", "65,536 tokens"], ["Next", "Qwen 4 27B, at launch"]],
};

export const alpha = [
  "Tenvor is in alpha. Current limits are on the <a href=\"/trust\">Trust page</a>.",
  "If a request fails on a node before any output is sent, Tenvor may retry it once on another node, if one is free. You are not charged for the attempt that failed.",
  "If a request fails on a node after output has started, you are not charged and it is not retried. A request that you cancel, or that stops at your own output limit, can be charged for its input and the output it generated.",
  "Requests run in a sealed container, but they are not yet encrypted on the node that runs them. Use Tenvor for work that is not sensitive.",
];

export const steps = [
  { name: "Sign up", text: "New accounts start with $0.25 of free credit. No card needed." },
  { name: "Create an API key", text: "In the <a href=\"https://app.tenvor.io\" target=\"_blank\" rel=\"noopener\">Console</a>. Keys look like <code>sk-dc-…</code>" },
  { name: "Change your base URL", text: "Keep your SDK. The model id is <code>chat-35b-moe</code>" },
];
