import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-terms";

export const metadata: Metadata = { title: "Terms of Service | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
