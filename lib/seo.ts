import type { Metadata } from "next";

export const SITE = "https://tenvor.io";
const ogImage = "/img/og-image.jpg";

/** Plain-text summary of a page's intro, for meta description (~160 chars, cut at a word). */
export function describe(html: string, max = 160): string {
  const t = html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

/** Per-page metadata: title, description, canonical URL and share cards. */
export function pageMeta(title: string, path: string, intro: string): Metadata {
  const description = describe(intro);
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "Tenvor", type: "website", images: ogImage },
    twitter: { card: "summary_large_image", title, description, images: ogImage },
  };
}

/** JSON-LD script tag content; `<` escaped so text can never close the script. */
export const ld = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
