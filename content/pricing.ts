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
const consoleHref = "https://tenvor.io/console";

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
