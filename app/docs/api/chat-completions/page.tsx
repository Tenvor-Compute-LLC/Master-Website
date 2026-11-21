import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/api-chat-completions";

export const metadata: Metadata = { title: "Chat Completions API | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
