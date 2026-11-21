import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-service-credits";

export const metadata: Metadata = { title: "Service Credit & Refund Policy | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
