export type Kpi = { value: string; label: string };
export type UseCase = { tool: string; kind: string; status: string; title: string; body: string;
  art: "terminal" | "failover" | "node"; alt: string; href: string; link: string; kpis: Kpi[] };

export const cases: UseCase[] = [
  {
    tool: "OpenCode · Pi", kind: "Coding agents", status: "Live", art: "terminal",
    alt: "An isometric desk: a monitor runs opencode --agent tenvor-agent and asks Allow or Deny before an edit; the request passes an approval gate on a light trail to a GPU node serving chat-35b-moe, and cached input costs $0.063 per 1M tokens",
    title: "A coding agent on open models, set up in one line",
    body: "Run OpenCode or Pi on Tenvor with one setup command. The tenvor-agent asks before every tool call, and follow-up turns can reuse cached input at half the input price.",
    href: "/docs/integrations/pi", link: "Read the Pi guide",
    kpis: [{ value: "1 line", label: "Setup command" }, { value: "$0.063", label: "Cached input per 1M" }, { value: "64K", label: "Context tokens" }],
  },
  {
    tool: "OpenAI SDK", kind: "Chat apps", status: "Live", art: "failover",
    alt: "An isometric scene: a laptop sends a request on a light trail to a GPU node that drops it with no output, marked with a red cross; the request is retried once on a free node, and the failed try is billed $0.00",
    title: "A chat app that rides out a dropped node",
    body: "Point the OpenAI SDK you already use at Tenvor's base URL. Streaming, tools and reasoning work, and if a node fails before it replies, a free node may retry it once.",
    href: "/docs/api/chat-completions", link: "Read the API reference",
    kpis: [{ value: "$0.126", label: "Input per 1M tokens" }, { value: "$0.00", label: "Failed requests billed" }, { value: "$0.25", label: "Free credit, no card" }],
  },
  {
    tool: "Tenvor Node", kind: "Run a node", status: "Invite only", art: "node",
    alt: "An isometric PC with a glass side panel beside an NVIDIA GPU inside a sealed container, linked by orange light trails; the container's network line is cut, marked network: none",
    title: "Put an idle NVIDIA card to work on the network",
    body: "Tenvor Node tests your PC, then serves requests in a sealed container with no network. Pause it any time. Earnings accrue per token; payouts are not open yet.",
    href: "/operators", link: "See what a node needs",
    kpis: [{ value: "10 GB+", label: "NVIDIA video memory" }, { value: "35+", label: "Tokens a second, tested" }, { value: "60 GB", label: "Free disk" }],
  },
];
