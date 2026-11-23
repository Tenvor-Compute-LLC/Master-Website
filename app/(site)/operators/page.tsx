import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import "@/app/styles/anim-ops.css";
import page from "@/content/pages/operators";

export const metadata: Metadata = pageMeta("Run a node | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<DotArt scene="operators" label="A graphics card with its fans turning, tokens streaming out" />} />;
}
