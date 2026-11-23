import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import "@/app/styles/anim-ops.css";
import page from "@/content/pages/good";

export const metadata: Metadata = pageMeta("Open Science | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} />;
}
