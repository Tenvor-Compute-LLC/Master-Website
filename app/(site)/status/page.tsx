import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/status";

export const metadata: Metadata = { title: "Alpha status | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
