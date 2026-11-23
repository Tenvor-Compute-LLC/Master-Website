"use client";
import { useEffect, useRef, useState } from "react";

const N = 35, ACTIVE = 3; // 35B parameters, 3B active per token: one cell per billion
const pick = () => { const s = new Set<number>(); while (s.size < ACTIVE) s.add(Math.floor(Math.random() * N)); return s; };

/** Mixture-of-experts at a glance: 35 cells, a different 3 light up for each token. */
export default function MoeGrid() {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<Set<number>>(() => new Set([4, 17, 29]));
  const [tok, setTok] = useState(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id);
      if (e.isIntersecting) id = window.setInterval(() => { setOn(pick()); setTok(t => t + 1); }, 520);
    });
    io.observe(box.current!);
    return () => { io.disconnect(); clearInterval(id); };
  }, []);

  return (
    <div ref={box} className="moe" role="img" aria-label="35 billion parameters, 3 billion of them active for each token">
      <div className="moe__grid">{Array.from({ length: N }, (_, i) => <i key={i} className={on.has(i) ? "on" : undefined}></i>)}</div>
      <p className="mono moe__cap"><span>35B · 3B active</span><span className="moe__tok">token <b>{String(tok % 1000).padStart(3, "0")}</b></span></p>
    </div>
  );
}
