import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Integrations from "@/components/Integrations";
import Nav from "@/components/Nav";
import PageEffects from "@/components/PageEffects";
import PricingBand from "@/components/PricingBand";
import Problem from "@/components/Problem";
import Projects from "@/components/Projects";
import Sprite from "@/components/Sprite";
import Testimonials from "@/components/Testimonials";
import { monthly } from "@/content/pricing";
import { SITE, ld } from "@/lib/seo";

const homeLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Service", name: "Tenvor open-model API", serviceType: "OpenAI-compatible LLM inference API",
      provider: { "@id": `${SITE}/#org` }, url: SITE, areaServed: "Worldwide",
      description: "One OpenAI-compatible API for open models, served by distributed GPUs in sealed containers. Pay per token; every new account gets $0.25 of free credit.",
      offers: monthly.map(p => ({ "@type": "Offer", name: p.name, price: p.amount.replace(/[^0-9.]/g, ""), priceCurrency: "USD", description: p.blurb, url: `${SITE}/pricing` })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(homeLd)} />
      <Sprite />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Projects />
        <Integrations />
        <Testimonials />
        <PricingBand />
      </main>
      <Footer />
      <PageEffects />
    </>
  );
}
