"use client";
import { useEffect, useRef, useState } from "react";
import { LAND } from "@/content/globe-dots";

// Example cities only: the arcs are an illustration of routing, not live node locations or traffic.
const CITIES: [number, number][] = [
  [37.8, -122.4], [40.7, -74], [43.7, -79.4], [-23.5, -46.6], [51.5, -0.1], [50.1, 8.7], [6.5, 3.4],
  [19.1, 72.9], [1.35, 103.8], [35.7, 139.7], [37.6, 127], [-33.9, 151.2], [25.2, 55.3], [52.4, 4.9],
];
const TILT = 0.38, SPIN = 0.00012, SPAWN = 420, FLY = 1700, MAX = 8;
const vec = (lat: number, lon: number) => {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
};
const DOTS = Array.from({ length: LAND.length / 2 }, (_, i) => vec(LAND[2 * i] / 10, LAND[2 * i + 1] / 10));
const NODES = CITIES.map(([a, b]) => vec(a, b));
type Arc = { a: number; b: number; t0: number; done?: boolean };

/** Dotted globe of real coastlines, turning slowly, with requests flying between example cities. */
export default function Globe() {
  const box = useRef<HTMLCanvasElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const cv = box.current!, ctx = cv.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, W = 0, R = 0, dpr = 1, last = 0, rot = -1.2, prev = 0;
    const arcs: Arc[] = [], hits = new Map<number, number>();
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth * dpr; cv.width = cv.height = W; R = W * 0.4; };
    // rotate about the pole, then tilt toward the viewer; returns screen x, y and depth
    const proj = ([x, y, z]: number[], k = 1) => {
      const c = Math.cos(rot), s = Math.sin(rot), X = x * c + z * s, Z = -x * s + z * c;
      const Y = y * Math.cos(TILT) - Z * Math.sin(TILT), D = y * Math.sin(TILT) + Z * Math.cos(TILT);
      return [W / 2 + X * R * k, W / 2 - Y * R * k, D];
    };
    const slerp = (a: number[], b: number[], s: number) => {
      const w = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), q = Math.sin(w) || 1;
      const f = Math.sin((1 - s) * w) / q, g = Math.sin(s * w) / q;
      return [a[0] * f + b[0] * g, a[1] * f + b[1] * g, a[2] * f + b[2] * g];
    };
    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, W);
      const halo = ctx.createRadialGradient(W / 2, W / 2, R * 0.6, W / 2, W / 2, R * 1.08);
      halo.addColorStop(0, "rgba(255,90,31,0)"); halo.addColorStop(1, "rgba(255,90,31,.07)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(W / 2, W / 2, R * 1.08, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(W / 2, W / 2, R, 0, 7); ctx.stroke();
      const d = 1.1 * dpr;
      for (const v of DOTS) {
        const [x, y, z] = proj(v);
        if (z <= 0) continue;
        ctx.fillStyle = `rgba(237,237,240,${(0.12 + 0.55 * z).toFixed(2)})`;
        ctx.fillRect(x - d / 2, y - d / 2, d, d);
      }
      for (const a of arcs) {
        const s = Math.min(1, (now - a.t0) / FLY), A = NODES[a.a], B = NODES[a.b];
        const span = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
        ctx.beginPath(); let pen = false;
        for (let i = 0; i <= 40; i++) {
          const u = Math.max(0, s - 0.35) + (s - Math.max(0, s - 0.35)) * i / 40;
          const [x, y, z] = proj(slerp(A, B, u), 1 + Math.sin(Math.PI * u) * span * 0.08);
          if (z < 0.02) { pen = false; continue; }
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
        }
        const fade = s < 1 ? 1 : Math.max(0, 1 - (now - a.t0 - FLY) / 500);
        ctx.strokeStyle = `rgba(255,90,31,${(0.9 * fade).toFixed(2)})`; ctx.lineWidth = 1.4 * dpr; ctx.stroke();
      }
      NODES.forEach((v, i) => {
        const [x, y, z] = proj(v);
        if (z <= 0) return;
        const h = hits.get(i), p = h ? Math.min(1, (now - h) / 700) : 1;
        if (p < 1) { ctx.strokeStyle = `rgba(255,90,31,${(1 - p).toFixed(2)})`; ctx.lineWidth = dpr; ctx.beginPath(); ctx.arc(x, y, (3 + 12 * p) * dpr, 0, 7); ctx.stroke(); }
        ctx.fillStyle = "#ff5a1f"; ctx.beginPath(); ctx.arc(x, y, 2.4 * dpr, 0, 7); ctx.fill();
      });
    };
    const spawn = (t0: number) => {
      const a = Math.floor(Math.random() * NODES.length); let b = a;
      while (b === a) b = Math.floor(Math.random() * NODES.length);
      arcs.push({ a, b, t0 });
    };
    const step = (now: number) => {
      rot += (prev ? now - prev : 16) * SPIN; prev = now;
      if (now - last > SPAWN && arcs.length < MAX) { spawn(now); last = now; }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const age = now - arcs[i].t0;
        if (age >= FLY && !arcs[i].done) { arcs[i].done = true; hits.set(arcs[i].b, now); setN(c => c + 1); }
        if (age > FLY + 500) arcs.splice(i, 1);
      }
      draw(now); raf = requestAnimationFrame(step);
    };
    size();
    const ro = new ResizeObserver(() => { size(); if (still) draw(0); });
    ro.observe(cv);
    if (still) { [0, 3, 5, 8].forEach((a, i) => arcs.push({ a, b: [4, 9, 11, 2][i], t0: -FLY })); draw(0); return () => ro.disconnect(); }
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf); prev = 0;
      if (e.isIntersecting) raf = requestAnimationFrame(step);
    });
    io.observe(cv);
    return () => { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="glb">
      <canvas ref={box} className="glb__cv" role="img" aria-label="Illustration: a dotted globe with requests flying between cities" />
      <p className="mono moe__cap"><span>Illustration only</span><span className="moe__tok">requests <b>{String(n % 1000).padStart(3, "0")}</b></span></p>
    </div>
  );
}
