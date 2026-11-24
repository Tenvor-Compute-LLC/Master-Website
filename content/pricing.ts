export type Plan = {
  name: string;
  tag?: string;
  sub: string;
  amount: string;
  per?: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  hot?: boolean;
};

export const contactHref = "mailto:support@tenvor.io?subject=Tenvor%20team%20or%20enterprise%20pricing";
const consoleHref = "https://app.tenvor.io";

export const monthly: Plan[] = [
  {
    name: "Lite", sub: "For trying it out", amount: "$6", per: " / month",
    blurb: "$7 of usage a month at API prices: $1.75 fresh each week, about 12.8M tokens.",
    features: ["250 chat messages a week", "16% more than pay-as-you-go", "Every API key and Work", "Half of unused rolls over", "Cancel anytime"],
    cta: "Choose Lite", href: "/checkout?plan=lite",
  },
  {
    name: "Plus", tag: "Recommended", sub: "For everyday use", amount: "$12.50", per: " / month", hot: true,
    blurb: "$15 of usage a month at API prices: $3.75 fresh each week, about 27.3M tokens.",
    features: ["Everything in Lite", "600 chat messages a week", "20% more than pay-as-you-go", "Rollover lasts 90 days", "Refund of unused month", "Cancel anytime"],
    cta: "Choose Plus", href: "/checkout?plan=plus",
  },
  {
    name: "Max", sub: "For heavy daily use", amount: "$19", per: " / month",
    blurb: "$23 of usage a month at API prices: $5.75 fresh each week, about 41.9M tokens.",
    features: ["Everything in Plus", "900 chat messages a week", "21% more than pay-as-you-go", "Teams: write to us", "Cancel anytime"],
    cta: "Choose Max", href: "/checkout?plan=max",
  },
];

export const payg: Plan[] = [
  {
    name: "Free start", sub: "New accounts", amount: "$0.25", per: " free credit",
    blurb: "Every new account gets free credit to try the API, Chat and Work. No card needed.",
    features: ["No card needed", "One API key for API and Work", "Chat message about $0.0002", "Spend cap $0.10 per Work task", "Failed requests billed $0"],
    cta: "Get API key", href: consoleHref,
  },
  {
    name: "Pay per token", tag: "Live now", sub: "Prepaid credit", amount: "$0.126", per: " / 1M in", hot: true,
    blurb: "Output $0.81 and cached input $0.063 per 1M tokens. Minimum $0.000134 a request.",
    features: ["Qwen 3.6 35B, 65,536-token context", "OpenAI-compatible API", "A receipt on every request", "Cached input at half price", "Web search about $0.007", "Work sandbox $0.000046 a second"],
    cta: "Get API key", href: consoleHref,
  },
  {
    name: "Teams & Enterprise", sub: "Larger workloads", amount: "Custom",
    blurb: "Running more than one account covers, or buying for a team? Tell us what you plan to run.",
    features: ["Talk to us about volume", "Larger prepaid amounts", "Same API and model", "Alpha: capacity is limited", "No uptime SLA yet"],
    cta: "Write to us", href: contactHref,
  },
];

export const pricingTabs = [
  { id: "monthly", label: "Monthly plans", plans: monthly },
  { id: "payg", label: "Pay as you go", plans: payg },
];

// Detail under each tab, word for word from tenvor.io/pricing.
export const compare = {
  head: ["Lite", "Plus", "Max"],
  rows: [
    ["Weekly allowance", "$1.75", "$3.75", "$5.75"],
    ["Monthly usage value, at API prices", "$7", "$15", "$23"],
    ["Included chat messages a week", "250", "600", "900"],
  ],
  wide: [
    ["Rollover", "Half of what you do not use each week rolls over as credit, for 90 days."],
    ["API keys and Work", "It works with every API key on your account, in any OpenAI-compatible app or agent, and in Work."],
    ["Money-back guarantee", "Not satisfied? Ask for the unused part of this month's plan back."],
  ],
  note: "*Usage at API prices, as a fresh $1.75 (Lite), $3.75 (Plus) or $5.75 (Max) each week: about 12.8M, 27.3M or 41.9M tokens at a typical coding-agent mix. An included chat message carries up to the last 8,000 tokens of the conversation and replies with up to 1,000 tokens. Billed monthly. Cancel anytime.",
};

export const rates = { model: "MoE Chat (35B-A3B)", id: "chat-35b-moe", context: "65,536 tokens", input: "$0.126", cached: "$0.063", output: "$0.81" };

export const charging = [
  "Each request is charged for its tokens or the minimum of $0.000134, whichever is larger.",
  "Cached input is input the serving node can reuse from an earlier request, such as the repeated start of a conversation. It costs half the input price when a request asks for reuse and the node can reuse it.",
  "If a request fails on a node before any output is sent, Tenvor may retry it once on another node, if one is free. You are not charged for the attempt that failed. If a request fails on a node after output has started, you are not charged and it is not retried.",
  "A request that you cancel, or that stops at your own output limit, can be charged for its input and the output it generated.",
];

export const example = {
  rows: [["500 tokens in", "$0.000063"], ["150 tokens out", "$0.000122"], ["Charged", "$0.000185"], ["× 10,000 a month", "$1.85"]],
  note: "An estimate. The receipt for each request is the charge.",
};
