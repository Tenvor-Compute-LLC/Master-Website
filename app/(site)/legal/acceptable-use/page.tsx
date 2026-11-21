import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-acceptable-use";

export const metadata: Metadata = { title: "Acceptable Use Policy | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
