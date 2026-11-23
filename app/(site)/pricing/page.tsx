import type { Metadata } from "next";
import FAQ from "@/components/FAQ";
import PageEffects from "@/components/PageEffects";
import Pricing from "@/components/Pricing";
import { Eyebrow, H2 } from "@/components/ui";
import page from "@/content/pages/pricing";
import { faqs } from "@/content/faq";
import { ld, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("Pricing | Tenvor", page.path, page.intro);

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
            <div className="docs__prose site__prose" dangerouslySetInnerHTML={{ __html: page.html }} />
          </div>
        </section>
        <FAQ />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
