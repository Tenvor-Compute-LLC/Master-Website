import type { Metadata } from "next";
import { Suspense } from "react";
import SitePageView from "@/components/SitePage";
import { checkoutPage, isPlan } from "@/content/pages/checkout";

export const metadata: Metadata = { title: "Checkout | Tenvor" };

type Props = { searchParams: Promise<{ plan?: string | string[] }> };

// The plan comes from the query string, so this part renders per request.
async function Checkout({ searchParams }: Props) {
  const { plan } = await searchParams;
  return <SitePageView page={checkoutPage(isPlan(plan) ? plan : "plus")} />;
}

export default function Page({ searchParams }: Props) {
  return <Suspense><Checkout searchParams={searchParams} /></Suspense>;
}
