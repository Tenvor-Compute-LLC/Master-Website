import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-privacy";

export const metadata: Metadata = { title: "Privacy Policy | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
