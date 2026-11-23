import type { Metadata } from "next";
import { Suspense } from "react";
import SitePageView from "@/components/SitePage";
import DotArt from "@/components/DotArt";
import { checkoutPage, isPlan } from "@/content/pages/checkout";

export const metadata: Metadata = { title: "Checkout | Tenvor", robots: { index: false, follow: true }, alternates: { canonical: "/checkout" } };

type Props = { searchParams: Promise<{ plan?: string | string[] }> };

// The plan comes from the query string, so this part renders per request.
async function Checkout({ searchParams }: Props) {
  const { plan } = await searchParams;
  const id = isPlan(plan) ? plan : "plus";
  return <SitePageView page={checkoutPage(id)} aside={<DotArt scene="checkout" label="Four weekly allowances drain in turn; half of what is left rolls over" />} />;
}

export default function Page({ searchParams }: Props) {
  return <Suspense><Checkout searchParams={searchParams} /></Suspense>;
}
