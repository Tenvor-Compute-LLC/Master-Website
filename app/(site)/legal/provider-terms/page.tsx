import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-provider-terms";

export const metadata: Metadata = { title: "Compute Provider Terms | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
