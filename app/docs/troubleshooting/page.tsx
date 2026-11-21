import type { Metadata } from "next";
import { DocArticle } from "@/components/DocShell";
import page from "@/content/docs/troubleshooting";

export const metadata: Metadata = { title: "Troubleshooting | Tenvor Docs" };

export default function Page() {
  return <DocArticle page={page} />;
}
