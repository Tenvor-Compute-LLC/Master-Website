import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import DocFlow from "@/components/DocFlow";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/quickstart";

export const metadata: Metadata = pageMeta("Your first request | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} aside={<DocFlow />} />;
}
