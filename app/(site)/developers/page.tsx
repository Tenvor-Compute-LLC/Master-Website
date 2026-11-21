import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/developers";

export const metadata: Metadata = { title: "Build with Tenvor | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
