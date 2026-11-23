import type { Metadata } from "next";
import About from "@/components/About";
import Journal from "@/components/Journal";
import PageEffects from "@/components/PageEffects";
import { about } from "@/content/about";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("About | Tenvor", "/about", about.side);

export default function Page() {
  return (
    <>
      <main className="subpage"><About /><Journal /></main>
      <PageEffects intro={false} />
    </>
  );
}
