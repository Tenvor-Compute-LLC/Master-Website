import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/billing";

export const metadata: Metadata = { title: "Billing and receipts | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
