import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-cookies";

export const metadata: Metadata = { title: "Cookie & Browser Storage Notice | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
