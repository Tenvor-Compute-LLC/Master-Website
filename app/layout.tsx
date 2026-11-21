import type { Metadata } from "next";
import "./globals.css";

const title = "Tenvor | The open-model network";
const description = "One orchestration layer for open models, running across distributed GPUs in sealed containers. Start free with no card.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  openGraph: { title, description, images: "/img/og-image.jpg" },
  icons: { icon: [{ url: "/img/favicon.svg", type: "image/svg+xml" }, { url: "/img/favicon.png", sizes: "32x32" }], apple: "/img/apple-touch-icon.png" },
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
      <body>{children}</body>
    </html>
  );
}
