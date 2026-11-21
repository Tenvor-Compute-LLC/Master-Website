import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/pricing";

export const metadata: Metadata = { title: "Pricing | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
