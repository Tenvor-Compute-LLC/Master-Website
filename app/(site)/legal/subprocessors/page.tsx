import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/legal-subprocessors";

export const metadata: Metadata = { title: "Subprocessor & Network Disclosure | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
