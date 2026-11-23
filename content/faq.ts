export type Faq = { q: string; a: string; href?: string };

export const faqs: Faq[] = [
  { q: "What is Tenvor?", a: "One OpenAI-compatible API for open models, served by GPUs in PCs around the world. Each request goes to the machine best suited for it, and if one drops, a free one takes over." },
  { q: "Is it safe to run on other people’s PCs?", a: "Each request runs in a sealed container: no network, rootless, reading only the model files. It is sealed, not encrypted: the node can read your prompt, so keep sensitive data out during the alpha.", href: "/trust" },
  { q: "Do you keep my prompts and outputs?", a: "No. Requests are never logged, and a request’s files are erased when it finishes. The content you send is never used to train models unless you opt in.", href: "/legal/privacy" },
  { q: "Which models can I use?", a: "One today: Qwen 3.6 35B (chat-35b-moe), with a 64K context, tool calls, reasoning and streaming. Qwen 4 27B is next; its model id and prices are announced at launch.", href: "/models" },
  { q: "What does it cost?", a: "You pay per token: $0.126 per million in, $0.063 cached, $0.81 out. Failed requests are never billed. Every new account gets $0.25 of free credit, no card needed.", href: "/pricing" },
  { q: "Do I need to change my code?", a: "Only the base URL and the key. Tenvor speaks the OpenAI API, so the OpenAI SDKs, curl and JetBrains AI work as they are, and OpenCode and Pi set up in one line.", href: "/docs/quickstart" },
  { q: "What happens if a machine drops out?", a: "If a node fails before any output, Tenvor may retry once on another free node. If it fails mid-stream, it is not retried. Either way you pay nothing. In the alpha there is no uptime SLA.", href: "/docs/models-and-limits" },
  { q: "Can I run a node on my own GPU?", a: "Yes, by invitation. You need an NVIDIA card with 10 GB+ of video memory on Windows 11 or Linux. The app tests your PC first, and you can pause it any time. Payouts are not open yet.", href: "/operators" },
  { q: "How is my data handled?", a: "These protections are applied by the worker software on the operator's machine, and no third party has audited or penetration-tested the service yet. Do not submit secrets or sensitive, regulated, or highly confidential personal data.", href: "/trust" },
  { q: "Do I need a plan?", a: "No. Without a plan you pay for what you use, from prepaid credit. New accounts start with $0.25 of free credit.", href: "/docs/billing" },
  { q: "Can I cancel?", a: "Yes, at any time, from the console or by writing to billing@tenvor.io. Cancellation takes effect at the end of the paid month, and you keep the plan until then.", href: "/legal/service-credits" },
  { q: "Is there a money-back guarantee?", a: "Not satisfied? Ask for the unused part of this month's plan back. It is an alpha guarantee, and each account can use it once.", href: "/legal/service-credits" },
];
