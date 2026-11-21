export type Post = { kind: string; meta: string; title: string; href: string; art: "request" | "terminal" | "receipt"; alt: string };

export const posts: Post[] = [
  { kind: "Quickstart", meta: "5 steps", title: "Your first request: a reply and its receipt in five steps", href: "/docs/quickstart", art: "request", alt: "An isometric scene: five numbered steps light up along a trail from a laptop to one GPU node serving chat-35b-moe, and the reply ends in a printed receipt: 14 tokens in, 9 tokens out, about $0.000009" },
  { kind: "Setup", meta: "One command", title: "Set up OpenCode: one command, every tool call approved", href: "/docs/integrations/opencode", art: "terminal", alt: "An isometric terminal runs the one OpenCode setup command, curl then bash tenvor-opencode.sh, and ticks off OpenCode 1.19.0, provider tenvor and agent tenvor-agent while the OpenCode package lands beside it" },
  { kind: "Reference", meta: "API docs", title: "Billing and receipts: what you pay for each request", href: "/docs/billing", art: "receipt", alt: "An isometric printer prints an itemised receipt for chat-35b-moe: input, cached input and output tokens, a failed try at $0.00, and about 9 micro-dollars charged, beside a stack of receipts, one per request" },
];
