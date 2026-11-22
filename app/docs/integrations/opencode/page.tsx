import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/integrations-opencode";

export const metadata: Metadata = pageMeta("Set up OpenCode | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} />;
}
