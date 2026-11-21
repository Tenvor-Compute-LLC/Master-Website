import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-security";

export const metadata: Metadata = { title: "Security Reporting Policy | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
