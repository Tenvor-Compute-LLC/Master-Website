import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import DotArt from "@/components/DotArt";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/quickstart";

export const metadata: Metadata = pageMeta("Your first request | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} aside={<DotArt scene="docs" label="Code typed line by line, then the response comes back" />} />;
}
