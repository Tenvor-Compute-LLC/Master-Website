import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/quickstart";

export const metadata: Metadata = { title: "Your first request | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
