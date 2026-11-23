"use client";
import { useEffect, useState, type RefObject } from "react";

/** Loop time in ms, quantised to 40 ms, running only while `box` is on screen. Returns `done` before hydration, with reduced motion and off screen. */
export function useLoop(box: RefObject<HTMLElement | null>, loop: number, done: number) {
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
  }, [box, loop, done]);
  return e;
}
