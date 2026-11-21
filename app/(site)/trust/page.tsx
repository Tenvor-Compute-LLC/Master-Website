import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/trust";

export const metadata: Metadata = { title: "Trust center | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
