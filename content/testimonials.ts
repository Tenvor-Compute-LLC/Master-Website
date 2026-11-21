export type Testimonial = { tag: string; text: string; href: string; label: string; dest: string };

// Facts from our own pricing, trust and docs pages; no customer quotes.
export const testimonials: Testimonial[] = [
  { tag: "$0.25 free", text: "Every new account gets $0.25 of credit. No card needed.", href: "/pricing", label: "Pricing", dest: "Pricing page" },
  { tag: "$0.126 / 1M", text: "Per-token prices for input, cached input and output. No GPU hours.", href: "/models", label: "Models", dest: "Models page" },
  { tag: "$0.00 failed", text: "If a node drops out before any output, the request moves to the next machine and you never pay for the failed try.", href: "/trust", label: "Trust", dest: "Trust page" },
  { tag: "Sealed", text: "Every request runs in a sealed container on the node.", href: "/trust", label: "Trust", dest: "Trust page" },
  { tag: "One API", text: "OpenAI-compatible. Change the base URL and keep your code.", href: "/docs/quickstart", label: "Quickstart", dest: "Quickstart docs" },
  { tag: "Never kept", text: "Requests are never logged or kept.", href: "/legal/privacy", label: "Privacy", dest: "Privacy policy" },
];
