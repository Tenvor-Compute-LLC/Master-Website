import type { Metadata } from "next";
import CtaBand from "@/components/CtaBand";
import FAQ from "@/components/FAQ";
import PageEffects from "@/components/PageEffects";
import Pricing from "@/components/Pricing";
import { Eyebrow, H2 } from "@/components/ui";
import page from "@/content/pages/pricing";
import { faqs } from "@/content/faq";
import { ld, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("Pricing | Tenvor", page.path, page.intro);

// the plan cards above already show Lite, Plus and Max; drop the same cards from the page text, keep its footnote and compare table
const details = page.html.replace(/<ul><li><div class="s-card">[\s\S]*?<\/ul>(?=<p>\*Usage)/, "");
if (details === page.html) throw new Error("pricing: plan cards not found in page text");

const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(faqLd)} />
      <main className="subpage">
        <Pricing />
        <section className="sec" id="details">
          <div className="wrap">
            <Eyebrow num="02">Details</Eyebrow><H2>Plans, rates and limits.</H2>
            <p className="lead site__lead">{page.intro}</p>
            <div className="docs__prose site__prose" dangerouslySetInnerHTML={{ __html: details }} />
          </div>
        </section>
        <FAQ />
        <CtaBand num="04" eyebrow="Get started" title="Start free, no card." text="Start with a free API key and $0.25 of credit. No card needed, no subscription."
          primary={{ href: "https://tenvor.io/console", label: "Get an API key" }} secondary={{ href: "/contact", label: "Talk to us" }} />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
