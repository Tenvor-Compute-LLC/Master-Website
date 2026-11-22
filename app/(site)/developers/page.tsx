import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/developers";

export const metadata: Metadata = pageMeta("Build with Tenvor | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} />;
}
