import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import CtaBand from "@/components/CtaBand";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("Products | Tenvor", "/products", "One GPU network, six ways to use it: an OpenAI-compatible API for open models, served by distributed GPUs in sealed containers.");

export default function Page() {
  return (
    <>
      <main className="subpage">
        <Services />
        <Stats />
        <CtaBand num="03" eyebrow="Pricing" title="Pay monthly or per token." text="New accounts start with $0.25 of free credit; failed requests cost $0."
          primary={{ href: "/pricing", label: "See pricing" }} secondary={{ href: "/docs/quickstart", label: "Read the quickstart" }} />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
