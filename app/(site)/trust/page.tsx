import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/trust";

export const metadata: Metadata = { title: "Trust and methodology | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
