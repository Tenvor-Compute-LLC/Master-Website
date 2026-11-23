import type { Metadata } from "next";
import { describe, ld, pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import page from "@/content/pages/trust";

export const metadata: Metadata = pageMeta("Trust center | Tenvor", page.path, page.intro);

// FAQ structured data, read from the page's own FAQ block
const faq = page.html.split('class="tc-faq"')[1]?.split("</section>")[0] ?? "";
const trustLd = {
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: [...faq.matchAll(/<summary>(.*?)<\/summary><p>(.*?)<\/p>/g)].map(m => ({ "@type": "Question", name: describe(m[1], 300), acceptedAnswer: { "@type": "Answer", text: describe(m[2], 1000) } })),
};

export default function Page() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={ld(trustLd)} /><SitePageView page={page} aside={<DotArt scene="trust" label="A request travels plain, scrambled in transit, then into a sealed container where it is erased" />} /></>;
}
