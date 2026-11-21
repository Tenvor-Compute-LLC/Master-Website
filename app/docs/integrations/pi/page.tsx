import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/integrations-pi";

export const metadata: Metadata = { title: "Set up Pi | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
