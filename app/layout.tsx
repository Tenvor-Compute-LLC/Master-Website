import type { Metadata } from "next";
import "./globals.css";
import { SITE, ld } from "@/lib/seo";

const title = "Tenvor | The open-model network";
const description = "One orchestration layer for open models, running across distributed GPUs in sealed containers. Start free with no card.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? SITE),
  title,
  description,
  applicationName: "Tenvor",
  keywords: ["open models", "OpenAI-compatible API", "LLM API", "GPU cloud", "distributed GPUs", "decentralized inference", "Qwen API", "AI inference", "cheap LLM API", "run a GPU node"],
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", siteName: "Tenvor", type: "website", locale: "en_US", images: "/img/og-image.jpg" },
  twitter: { card: "summary_large_image", title, description, images: "/img/og-image.jpg" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  icons: { icon: [{ url: "/img/favicon.svg", type: "image/svg+xml" }, { url: "/img/favicon.png", sizes: "32x32" }], apple: "/img/apple-touch-icon.png" },
};

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE}/#org`, name: "Tenvor", legalName: "Tenvor Compute LLC", url: SITE, logo: `${SITE}/img/apple-touch-icon.png`, email: "support@tenvor.io", description, sameAs: ["https://www.linkedin.com/company/tenvor-compute/"] },
    { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Tenvor", url: SITE, publisher: { "@id": `${SITE}/#org` } },
  ],
};

// Runs before paint, as in the static <head>: marks JS on (reveal CSS) and pre-hides sections for the Swarm Build intro
const boot = `(function(){var d=document.documentElement;function v(){d.classList.toggle("swb-bg",document.visibilityState==="hidden")}v();document.addEventListener("visibilitychange",v);d.classList.add("swb-hide","js")})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the boot script adds classes to <html> before hydration
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Google Fonts families; family names are referenced literally in CSS and the Swarm Build engine */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400;500;600&family=Funnel+Sans:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={ld(siteLd)} />
        {children}
      </body>
    </html>
  );
}
