import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/integrations-opencode";

export const metadata: Metadata = { title: "Set up OpenCode | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
