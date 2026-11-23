import type { Metadata } from "next";
import { Suspense } from "react";
import SitePageView from "@/components/SitePage";
import { checkoutPage, isPlan } from "@/content/pages/checkout";

export const metadata: Metadata = { title: "Checkout | Tenvor", robots: { index: false, follow: true }, alternates: { canonical: "/checkout" } };

type Props = { searchParams: Promise<{ plan?: string | string[] }> };

// The plan comes from the query string, so this part renders per request.
async function Checkout({ searchParams }: Props) {
  const { plan } = await searchParams;
  const id = isPlan(plan) ? plan : "plus";
  return <SitePageView page={checkoutPage(id)} />;
}

export default function Page({ searchParams }: Props) {
  return <Suspense><Checkout searchParams={searchParams} /></Suspense>;
}
