"use client";
import { useEffect, useRef, useState } from "react";

/** Loop time in ms, quantised to 40 ms; runs only while on screen. Holds `done` before hydration, off screen and with reduced motion. */
export function useLoop(loop: number, done: number) {
  const box = useRef<HTMLDivElement>(null);
  const [e, setE] = useState(done);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0, last = -1;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.floor(((now - t0) % loop) / 40) * 40;
      if (t !== last) { last = t; setE(t); }
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([en]) => {
      cancelAnimationFrame(raf);
      if (en.isIntersecting) { t0 = 0; raf = requestAnimationFrame(step); } else setE(done);
    }, { threshold: 0.35 });
    io.observe(box.current!);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [loop, done]);
  return [box, e] as const;
}

export const clamp = (v: number) => Math.max(0, Math.min(1, v));
