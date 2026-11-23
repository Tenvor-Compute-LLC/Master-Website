"use client";
import { useEffect, useRef } from "react";

/** Reading progress for a policy: a bar along the top, the current section marked in the sidebar and the document map, sections easing in. */
export default function LegalReading() {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const prose = document.querySelector<HTMLElement>(".docs__prose");
    if (!prose) return;
    const hs = [...prose.querySelectorAll<HTMLElement>("h2[id]")];
    const parts = hs.length ? hs : [...prose.querySelectorAll<HTMLElement>("li")]; // same parts LegalDoc draws
    const rows = [...document.querySelectorAll<HTMLElement>(".lgd__row")];
    const links = hs.map(h => document.querySelector<HTMLElement>(`.docs__side a[href="#${CSS.escape(h.id)}"]`));
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.4, r = prose.getBoundingClientRect();
      bar.current!.style.transform = `scaleX(${Math.max(0, Math.min(1, (line - r.top) / r.height))})`;
      let cur = -1;
      parts.forEach((p, i) => { if (p.getBoundingClientRect().top < line) cur = i; });
      rows.forEach((row, i) => row.classList.toggle("is-read", i <= cur));
      links.forEach((a, i) => a?.classList.toggle("is-cur", i === cur));
    };
    const on = () => { raf ||= requestAnimationFrame(update); };
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    update();
    // headings and policy cards ease in once; without JS or with reduced motion they are simply there
    let io: IntersectionObserver | undefined;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io!.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
      prose.querySelectorAll("h2, blockquote, .s-card").forEach(el => {
        if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("lgr"); io!.observe(el); }
      });
    }
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); io?.disconnect(); };
  }, []);
  return <div className="lgp" aria-hidden="true"><span ref={bar}></span></div>;
}
