import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-provider-terms";

export const metadata: Metadata = pageMeta("Compute Provider Terms | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} />;
}
