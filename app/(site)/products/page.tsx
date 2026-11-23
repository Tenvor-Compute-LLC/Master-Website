import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import Process from "@/components/Process";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("Products | Tenvor", "/products", "One GPU network, six ways to use it: an OpenAI-compatible API for open models, served by distributed GPUs in sealed containers.");

export default function Page() {
  return (
    <>
      <main className="subpage"><Services /><Process /><Stats /></main>
      <PageEffects intro={false} />
    </>
  );
}
