import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/chat";

export const metadata: Metadata = { title: "Chat & Work | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
