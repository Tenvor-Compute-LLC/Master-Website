"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { guides } from "@/content/docs";

/** The "Documentation" guide list; the current page is marked. */
export default function DocGuides() {
  const path = usePathname();
  return guides.map((g, i) => (
    <div key={i}>
      {g.group && <p className="docs__g">{g.group}</p>}
      <ul>{g.links.map(l => <li key={l.href}><Link href={l.href} aria-current={l.href === path ? "page" : undefined}>{l.label}</Link></li>)}</ul>
    </div>
  ));
}
