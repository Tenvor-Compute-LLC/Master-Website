import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/models";

export const metadata: Metadata = { title: "Models | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
