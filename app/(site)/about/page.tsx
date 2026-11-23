import type { Metadata } from "next";
import About from "@/components/About";
import CtaBand from "@/components/CtaBand";
import Journal from "@/components/Journal";
import PageEffects from "@/components/PageEffects";
import { about } from "@/content/about";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("About | Tenvor", "/about", about.side);

export default function Page() {
  return (
    <>
      <main className="subpage">
        <About />
        <Journal />
        <CtaBand num="03" eyebrow="Contact" title="Talk to the team." text="Write to support@tenvor.io, or see how every request is kept sealed."
          primary={{ href: "/contact", label: "Contact us" }} secondary={{ href: "/trust", label: "Read Trust" }} />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
