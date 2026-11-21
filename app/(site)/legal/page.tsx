import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal";

export const metadata: Metadata = { title: "Public alpha policy library | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
