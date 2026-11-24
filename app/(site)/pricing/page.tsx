import type { Metadata } from "next";
import CtaBand from "@/components/CtaBand";
import FAQ from "@/components/FAQ";
import PageEffects from "@/components/PageEffects";
import Pricing from "@/components/Pricing";
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
        <FAQ />
        <CtaBand num="03" eyebrow="Get started" title="Start free, no card." text="Start with a free API key and $0.25 of credit. No card needed, no subscription."
          primary={{ href: "https://app.tenvor.io", label: "Get an API key" }} secondary={{ href: "/contact", label: "Talk to us" }} />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
