import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/troubleshooting";

export const metadata: Metadata = pageMeta("Troubleshooting | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} />;
}
