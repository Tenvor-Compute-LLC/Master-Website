"use client";
import { useEffect } from "react";

/** Code blocks in .docs__body type in once, line by line, the first time each scrolls into view. Without JS or with reduced motion they are simply there. */
export default function DocType() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pres = [...document.querySelectorAll<HTMLPreElement>(".docs__body pre")].filter(p => p.querySelector(".d-l"));
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add("dt-go");
      io.unobserve(en.target);
    }), { threshold: 0.2 });
    pres.forEach(p => {
      p.querySelectorAll<HTMLElement>(".d-l").forEach((l, i) => l.style.setProperty("--i", String(Math.min(i, 24))));
      p.classList.add("dt-arm");
      io.observe(p);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
