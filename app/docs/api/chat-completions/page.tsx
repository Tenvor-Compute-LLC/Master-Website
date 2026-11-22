import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/api-chat-completions";

export const metadata: Metadata = pageMeta("Chat Completions API | Tenvor Docs", page.path, page.intro);

export default function Page() {
  return <DocArticle page={page} />;
}
