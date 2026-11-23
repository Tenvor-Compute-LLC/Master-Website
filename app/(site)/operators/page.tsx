import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import NodeDay from "@/components/NodeDay";
import page from "@/content/pages/operators";

export const metadata: Metadata = pageMeta("Run a node | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<NodeDay />} />;
}
