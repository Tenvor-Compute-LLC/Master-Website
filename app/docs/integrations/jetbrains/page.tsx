import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/integrations-jetbrains";

export const metadata: Metadata = { title: "Set up JetBrains AI Assistant | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
