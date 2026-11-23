"use client";
import { useEffect, useRef } from "react";
import { SCENES, type SceneName } from "./dotScenes";

const COLS = 34, ROWS = 26;
// tone 0 white, 1 accent, 2 green; the scene returns tone + brightness (0..0.999)
const RGB = ["237,237,240", "255,90,31", "34,197,94"];

/** Borderless dot-matrix illustration: one grid, a different scene per page. Runs only on screen; still with reduced motion. */
export default function DotArt({ scene, label }: { scene: SceneName; label: string }) {
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = cv.current!, ctx = el.getContext("2d")!, { fn, still } = SCENES[scene];
    let raf = 0, t0 = 0, W = 0, H = 0, s = 0;
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = el.width = el.clientWidth * dpr; H = el.height = el.clientWidth * dpr * ROWS / COLS; s = W / COLS;
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const n = fn(c, r, t, COLS, ROWS), tone = Math.min(2, Math.floor(n)), v = Math.max(0, Math.min(1, n - tone));
        ctx.fillStyle = `rgba(${RGB[tone]},${(tone ? 0.3 + 0.7 * v : 0.1 + 0.8 * v).toFixed(3)})`;
        ctx.beginPath(); ctx.arc((c + 0.5) * s, (r + 0.5) * s, s * (0.12 + 0.2 * v), 0, 6.283); ctx.fill();
      }
    };
    const step = (now: number) => { if (!t0) t0 = now; draw((now - t0) / 1000); raf = requestAnimationFrame(step); };
    size();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ro = new ResizeObserver(() => { size(); draw(still); });
    ro.observe(el);
    draw(still);
    if (reduced) return () => ro.disconnect();
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf); t0 = 0;
      if (e.isIntersecting) raf = requestAnimationFrame(step); else draw(still);
    });
    io.observe(el);
    return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [scene]);

  return <canvas ref={cv} className="dotart" style={{ aspectRatio: `${COLS}/${ROWS}` }} role="img" aria-label={label} />;
}
