import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-public-alpha-risk";

export const metadata: Metadata = { title: "Public Alpha Risk Notice | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
