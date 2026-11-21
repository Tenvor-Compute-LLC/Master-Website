"use client";
import Link from "next/link";
import { useState } from "react";
import { Btn } from "./ui";

const links = [["/#services", "Products"], ["/#pricing", "Pricing"], ["/docs", "Docs"], ["/operators", "Run a node"], ["/#about", "About"]];
const ext = (h: string) => h.startsWith("http") ? { target: "_blank", rel: "noopener" } : {};

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className={`nav${open ? " open" : ""}`}>
      <div className="wrap nav__in">
        <Link href="/" className="brand"><img className="brand__mark" src="/img/logo-t.svg" alt="" />Tenvor<sup>®</sup></Link>
        <nav className="nav__links" id="menu">
          {links.map(([href, label]) => href.startsWith("http")
            ? <a key={href} href={href} {...ext(href)} onClick={() => setOpen(false)}>{label}</a>
            : <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link className="nav__join" href="/operators" onClick={() => setOpen(false)}><i className="dot"></i>Earn while Idle</Link>
        </nav>
        <div className="nav__right">
          <Link className="status mono" href="/operators"><i className="dot"></i>Earn while Idle</Link>
          <Btn href="https://tenvor.io/console" variant="accent">Console</Btn>
          <button className="burger" aria-label="Open menu" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(o => !o)}><span></span><span></span></button>
        </div>
      </div>
    </header>
  );
}
