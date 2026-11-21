import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/models-and-limits";

export const metadata: Metadata = { title: "Models and limits | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
