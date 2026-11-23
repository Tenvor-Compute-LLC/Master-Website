import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import ReportFlow from "@/components/ReportFlow";
import page from "@/content/pages/legal-security";

export const metadata: Metadata = pageMeta("Security Reporting Policy | Tenvor", page.path, page.intro);

export default function Page() {
  return <SitePageView page={page} aside={<ReportFlow />} />;
}
