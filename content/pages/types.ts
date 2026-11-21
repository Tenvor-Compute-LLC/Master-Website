import type { NavLink } from "@/content/docs/types";
/** One tenvor.io content page. intro and html are the source text, verbatim, in cleaned markup (s-* classes); links to pages built here are internal. */
export type SitePage = { path: string; metaTitle: string; kicker: string; title: string; intro: string; toc: NavLink[]; html: string };

// The source's policy library sidebar; every entry is a page on this site.
export const legalNav: NavLink[] = [
  { href: "/legal", label: "Policy overview" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/acceptable-use", label: "Acceptable Use Policy" },
  { href: "/legal/provider-terms", label: "Compute Provider Terms" },
  { href: "/legal/service-credits", label: "Service Credit & Refund Policy" },
  { href: "/legal/cookies", label: "Cookie & Browser Storage Notice" },
  { href: "/legal/subprocessors", label: "Subprocessor & Network Disclosure" },
  { href: "/legal/security", label: "Security Reporting Policy" },
  { href: "/legal/public-alpha-risk", label: "Public Alpha Risk Notice" },
];
