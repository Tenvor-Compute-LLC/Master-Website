"use client";
import { useEffect, useState, type RefObject } from "react";

/**
 * Elapsed ms for a small animation, quantised to 40 ms, running only while `ref` is on screen.
 * Starts (and stays, with reduced motion or before JS) at `end`: the finished frame.
 * With `loop` it repeats every `loop` ms; without, it plays 0..end once, the first time it is seen.
 */
export function useTick(ref: RefObject<HTMLElement | null>, end: number, loop?: number) {
  const [e, setE] = useState(end);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0, last = -1, played = false;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const el = now - t0;
      if (!loop && el >= end) { setE(end); played = true; return; }
      const t = Math.floor((loop ? el % loop : el) / 40) * 40;
      if (t !== last) { last = t; setE(t); }
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([en]) => {
      cancelAnimationFrame(raf);
      if (en.isIntersecting && !played) { t0 = 0; raf = requestAnimationFrame(step); } else setE(end);
    }, { threshold: 0.35 });
    io.observe(ref.current!);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, end, loop]);
  return e;
}

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
