import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import SitePageView from "@/components/SitePage";
import "@/app/styles/anim-ops.css";
import page from "@/content/pages/operators";

export const metadata: Metadata = pageMeta("Run a node | Tenvor", page.path, page.intro);

export default function Page() {
  // The pitch line is shown on the page only; the meta description keeps the source intro.
  return <SitePageView page={{ ...page, intro: `Like renting out a spare room: think <span class="accent">Airbnb for idle GPUs</span>. List your GPU when you are not using it, and Tenvor brings the work and runs it in sealed containers. ${page.intro}` }} />;
}
