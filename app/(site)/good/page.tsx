import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import "@/app/styles/anim-ops.css";
import page from "@/content/pages/good";

export const metadata: Metadata = pageMeta("Open Science | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<DotArt scene="good" label="Idle machines light up and their donated work fills a shared circle" />} />;
}
