import type { Metadata } from "next";
import SitePageView from "@/components/SitePage";
import page from "@/content/pages/contact";

export const metadata: Metadata = { title: "Contact | Tenvor" };

export default function Page() {
  return <SitePageView page={page} />;
}
