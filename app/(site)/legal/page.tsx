import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import page from "@/content/pages/legal";

export const metadata: Metadata = pageMeta("Public alpha policy library | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<DotArt scene="legal" label="Lines of a policy, read top to bottom" />} />;
}
