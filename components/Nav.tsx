"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Btn } from "./ui";

type Item = { href: string; label: string };
type Group = { label: string; href?: string; items?: Item[] };

const groups: Group[] = [
  { label: "Products", items: [
    { href: "/products", label: "All products" }, { href: "/developers", label: "API" }, { href: "/models", label: "Models" },
    { href: "/chat", label: "Chat" }, { href: "/operators", label: "Run a node" },
  ] },
  { label: "Developers", items: [
    { href: "/docs", label: "Docs" }, { href: "/docs/quickstart", label: "Quickstart" }, { href: "/docs/api/chat-completions", label: "API reference" },
    { href: "/docs/models-and-limits", label: "Models and limits" }, { href: "/status", label: "Status" },
  ] },
  { label: "Pricing", href: "/pricing" },
  { label: "Company", items: [
    { href: "/about", label: "About" }, { href: "/trust", label: "Trust" }, { href: "/legal/security", label: "Security" },
    { href: "https://binary.so/tenvor", label: "Careers" }, { href: "/contact", label: "Contact" },
  ] },
];

const ext = (h: string) => h.startsWith("http") ? { target: "_blank", rel: "noopener" } : {};
// a link is current on its own page and on pages below it (Docs only on its own page: its sub pages have their own links)
const isCur = (path: string, href: string) => !href.startsWith("http") && (path === href || (href !== "/docs" && path.startsWith(href + "/")));

export default function Nav() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState<string | null>(null);
  const close = () => { setOpen(false); setDrop(null); };

  // Escape or a click outside closes an open menu
  useEffect(() => {
    if (!drop) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDrop(null);
    const click = (e: MouseEvent) => !(e.target as Element).closest(".nav__grp") && setDrop(null);
    addEventListener("keydown", key); addEventListener("click", click);
    return () => { removeEventListener("keydown", key); removeEventListener("click", click); };
  }, [drop]);

  const link = (i: Item) => {
    const cur = isCur(path, i.href);
    const p = { className: cur ? "cur" : undefined, "aria-current": cur ? "page" as const : undefined, onClick: close };
    return i.href.startsWith("http") ? <a key={i.href} href={i.href} {...ext(i.href)} {...p}>{i.label}</a> : <Link key={i.href} href={i.href} {...p}>{i.label}</Link>;
  };

  return (
    <header className={`nav${open ? " open" : ""}`}>
      <div className="wrap nav__in">
        <Link href="/" className="brand" onClick={close}><img className="brand__mark" src="/img/logo-t.svg" alt="" />Tenvor<sup>®</sup></Link>
        <nav className="nav__links" id="menu" aria-label="Main">
          {groups.map(g => {
            if (g.href) return link({ href: g.href, label: g.label });
            const id = "nav-" + g.label.toLowerCase();
            const active = g.items!.some(i => isCur(path, i.href)) || (g.label === "Developers" && path.startsWith("/docs"));
            return (
              <div key={g.label} className={`nav__grp${drop === g.label ? " is-open" : ""}`}
                onMouseEnter={() => matchMedia("(hover: hover) and (min-width: 901px)").matches && setDrop(g.label)}
                onMouseLeave={() => matchMedia("(hover: hover) and (min-width: 901px)").matches && setDrop(null)}>
                <button type="button" className={active ? "cur" : undefined} aria-expanded={drop === g.label} aria-controls={id}
                  onClick={() => setDrop(d => d === g.label ? null : g.label)}>{g.label}<i aria-hidden="true"></i></button>
                <div className="nav__drop" id={id}>{g.items!.map(link)}</div>
              </div>
            );
          })}
          <Link className="nav__join" href="/operators" onClick={close}><i className="dot"></i>Earn while Idle</Link>
        </nav>
        <div className="nav__right">
          <Link className="status mono" href="/operators"><i className="dot"></i>Earn while Idle</Link>
          <Btn href="https://app.tenvor.io" variant="accent">Login</Btn>
          <button className="burger" aria-label="Open menu" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(o => !o)}><span></span><span></span></button>
        </div>
      </div>
    </header>
  );
}
