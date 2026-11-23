"use client";
import { useEffect } from "react";
import { startSwarmBuild } from "@/lib/swarm-build";

/** Page-wide motion: h1 word reveal on load, scroll reveal for .reveal blocks and h2s, and the Swarm Build intro. */
export default function PageEffects({ intro = true }: { intro?: boolean }) {
  useEffect(() => {
    const h1 = document.querySelector(".hero h1");
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => h1?.classList.add("in")); });

    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal, h2.h2").forEach(el => io.observe(el));

    // card art loops only while on screen; hovering the card replays it from the start
    const arts = [...document.querySelectorAll<HTMLElement>(".art")];
    const artIo = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle("on", e.isIntersecting)), { threshold: 0.3 });
    const replay = (e: Event) => {
      const a = (e.currentTarget as HTMLElement).querySelector(".art");
      if (!a?.classList.contains("on")) return;
      a.classList.remove("on"); void a.getBoundingClientRect(); a.classList.add("on");
    };
    arts.forEach(a => { artIo.observe(a); a.closest(".post, .case")?.addEventListener("mouseenter", replay); });

    // isometric maps (SMIL): run only while on screen; with reduced motion, hold the finished frame
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const maps = [...document.querySelectorAll<SVGSVGElement>(".ucmap svg")];
    const mapIo = new IntersectionObserver(entries => entries.forEach(e => {
      const m = e.target as SVGSVGElement;
      if (still) { m.setCurrentTime(+(m.dataset.still ?? 0)); m.pauseAnimations(); }
      else if (e.isIntersecting) m.unpauseAnimations(); else m.pauseAnimations();
    }));
    maps.forEach(m => mapIo.observe(m));

    // no intro: mark the page built so the boot script's section hiding lifts at once
    const stopSwarm = intro ? startSwarmBuild() : (document.documentElement.classList.add("swb-ready"), () => document.documentElement.classList.remove("swb-ready"));
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); io.disconnect(); stopSwarm();
      artIo.disconnect(); mapIo.disconnect(); arts.forEach(a => a.closest(".post, .case")?.removeEventListener("mouseenter", replay)); };
  }, [intro]);
  return null;
}
