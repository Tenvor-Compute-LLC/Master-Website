"use client";
import { useEffect, useRef, useState } from "react";
import { live, next } from "@/content/models";

const LOOP = 8000;
const DONE = 5200; // the settled frame: before hydration, with reduced motion, and while off screen
const ASK = `model="${live.id}"`;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Hero: the request names a model id, the live model picks it up and its features switch on one by one. */
export default function ModelRoster() {
  const box = useRef<HTMLDivElement>(null);
  const [e, setE] = useState(DONE);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0, last = -1;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.floor(((now - t0) % LOOP) / 40) * 40;
      if (t !== last) { last = t; setE(t); }
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([en]) => {
      cancelAnimationFrame(raf);
      if (en.isIntersecting) { t0 = 0; raf = requestAnimationFrame(step); } else setE(DONE);
    }, { threshold: 0.35 });
    io.observe(box.current!);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const typed = ASK.slice(0, Math.round(clamp((e - 200) / 1200) * ASK.length));
  const hit = e >= 1600 && e < LOOP - 400;
  const tags = hit ? Math.min(live.tags.length, Math.floor((e - 1900) / 260) + 1) : 0;
  const fill = clamp((e - 1900) / 2600);

  return (
    <div ref={box} className="agent ros reveal">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Models</b><span className="mono live"><i className="dot"></i>1 live</span></div>
      <p className="mono ros__ask" aria-hidden="true"><span className="d-c">client.chat.completions.create(</span><br />&nbsp;&nbsp;<span className="d-s">{typed}</span>{e < 1600 && <span className="chat__caret"></span>}</p>
      <div className={`ros__row ros__row--live${hit ? " is-hit" : ""}`}>
        <div className="ros__top"><span className="mono ros__st"><i className="dot"></i>live</span><b>{live.name}</b><code>{live.id}</code></div>
        <ul className="tags">{live.tags.map((t, i) => <li key={t}><span className={`mono${i < tags ? " on" : ""}`}>{t}</span></li>)}</ul>
        <span className="ros__bar" aria-hidden="true"><span style={{ transform: `scaleX(${hit ? fill : 0})` }}></span></span>
      </div>
      <div className="ros__row ros__row--next">
        <div className="ros__top"><span className="mono ros__st ros__st--next">next</span><b>{next.name}</b><span className="mono ros__soon">{next.status}</span></div>
        <p className="mono ros__meta">{next.specs.map(s => s[1]).join(" · ")}</p>
      </div>
      <p className="mono chat__note">New open models are added as they&apos;re released.</p>
    </div>
  );
}
