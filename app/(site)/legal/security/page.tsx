import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import page from "@/content/pages/legal-security";

export const metadata: Metadata = pageMeta("Security Reporting Policy | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<DotArt scene="security" label="A scan sweeps the system, one issue is flagged, reported and fixed" />} />;
}
