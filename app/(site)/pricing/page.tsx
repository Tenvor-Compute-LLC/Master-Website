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

// The page text repeats what the plan cards, Chat page, Trust page and FAQ already say; keep only what is said nowhere else:
// the alpha note, the footnote, the compare table, the rate table and its rules, the cost example and the teams path.
const cut = (html: string, re: RegExp, to = "") => {
  const out = html.replace(re, to);
  if (out === html) throw new Error(`pricing: ${re} not found in page text`);
  return out;
};
const details = [
  [/<h2>Monthly plans<\/h2><p class="s-lede">[\s\S]*?<\/p>/, ""],                       // plan cards above say it
  [/<ul><li><div class="s-card">[\s\S]*?<\/ul>(?=<p>\*Usage)/, ""],                    // the plan cards themselves
  [/<div><h3>In Chat &amp; Work<\/h3>[\s\S]*?<\/dl><\/div>(?=<section id="calculator">)/, ""], // on the pay-as-you-go cards and Chat page
  [/<section id="data">[\s\S]*$/, '<section id="data"><h2 id="data-h">How your data is handled</h2><p>These protections are applied by the worker software on the operator\'s machine, and no third party has audited or penetration-tested the service yet. Do not submit secrets or sensitive, regulated, or highly confidential personal data. <a href="/trust">Read the Trust page</a> for how each request is handled.</p></section></div>'],
].reduce((h, [re, to]) => cut(h, re as RegExp, to as string), page.html);

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
