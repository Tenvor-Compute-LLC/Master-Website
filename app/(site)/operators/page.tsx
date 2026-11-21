import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/operators";

export const metadata: Metadata = { title: "Run a node | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
