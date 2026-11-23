import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import LegalDoc from "@/components/LegalDoc";
import page from "@/content/pages/legal";
import terms from "@/content/pages/legal-terms";
import privacy from "@/content/pages/legal-privacy";
import aup from "@/content/pages/legal-acceptable-use";
import provider from "@/content/pages/legal-provider-terms";
import credits from "@/content/pages/legal-service-credits";
import cookies from "@/content/pages/legal-cookies";
import subs from "@/content/pages/legal-subprocessors";
import security from "@/content/pages/legal-security";
import risk from "@/content/pages/legal-public-alpha-risk";

export const metadata: Metadata = pageMeta("Public alpha policy library | Tenvor", page.path, page.intro);

// one bar per policy, as long as that policy's text
const rows = [terms, privacy, aup, provider, credits, cookies, subs, security, risk].map(p => ({ label: p.title, n: p.html.replace(/<[^>]+>/g, "").length }));

export default function Page() {
  return <SitePageView page={page} aside={<LegalDoc page={page} rows={rows} unit="policies" note="Bar length is the length of each policy’s text." />} />;
}
