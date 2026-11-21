import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/good";

export const metadata: Metadata = { title: "Open Science | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
