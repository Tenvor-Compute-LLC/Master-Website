import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/models-and-limits";

export const metadata: Metadata = pageMeta("Models and limits | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} />;
}
