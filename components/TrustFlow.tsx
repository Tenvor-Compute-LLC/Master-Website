"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const LOOP = 11000;
const DONE = 9400; // the settled frame: before hydration, with reduced motion, and while off screen
const PROMPT = "Summarise this contract";
const HASH = "sha256:9f2c…41ab";
// Stage text is the Trust page's own wording (tenvor.io/trust, Our commitments and Security program).
const STAGES = [
  { k: "You → Tenvor", t: "Clients connect over HTTPS.", at: 0 },
  { k: "Tenvor → node", t: "Nodes connect over an encrypted WebSocket.", at: 1500 },
  { k: "On the node", t: "The model runs locked down.", at: 3000 },
  { k: "Billing", t: "We count the tokens ourselves.", at: 5600 },
  { k: "Retention", t: "A request’s content and files are erased when it finishes.", at: 7400 },
];
const LOCKS = ["no network", "all capabilities dropped", "weights read-only"];
const HEX = "0123456789abcdef";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Same length as the prompt, characters swapped for hex: the prompt as it looks in transit. */
const scramble = (s: string, e: number) => [...s].map((c, i) => c === " " ? " " : HEX[(i * 7 + Math.floor(e / 70)) % 16]).join("");

/** One request, start to finish: sent, encrypted on the way, run in a sealed container, counted, then erased. */
export default function TrustFlow() {
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

  const stage = STAGES.reduce((n, s, i) => (e >= s.at ? i : n), 0);
  const done = e >= DONE - 400;
  // the prompt: plain on your side, hex in transit, plain again inside the container, then wiped character by character
  const wipe = Math.round(clamp((e - 7600) / 1200) * PROMPT.length);
  const text = e < 1500 ? PROMPT.slice(0, Math.round(clamp(e / 900) * PROMPT.length))
    : e < 3000 ? scramble(PROMPT, e)
    : e < 7600 ? PROMPT
    : "·".repeat(PROMPT.length - wipe);
  const locks = clamp((e - 3300) / 1500) * LOCKS.length;
  const hash = HASH.slice(0, Math.round(clamp((e - 4500) / 700) * HASH.length));
  const count = clamp((e - 5800) / 1200);

  return (
    <div ref={box} className="agent tf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>One request</b><span className="mono live"><i className="dot"></i>{done ? "erased" : "in flight"}</span></div>
      <p className={`mono tf__msg${e >= 1500 && e < 3000 ? " is-enc" : ""}${e >= 7600 ? " is-gone" : ""}`}><span className="tf__lbl">{e >= 1500 && e < 3000 ? "encrypted" : e >= 7600 ? (done ? "erased" : "erasing") : "prompt"}</span>{text}{e < 1500 && <span className="chat__caret"></span>}</p>
      <ol className="tf__list" style={{ "--p": done ? 1 : stage / (STAGES.length - 1) } as CSSProperties}>
        {STAGES.map((s, i) => (
          <li key={s.k} className={done || i < stage ? "is-done" : i === stage ? "is-on" : undefined}>
            <span className="mono tf__k">{s.k}</span>
            <span className="tf__t">{s.t}</span>
            {i === 2 && <span className="tf__locks">
              {LOCKS.map((l, j) => <span key={l} className={`mono tf__lock${done || j < locks ? " on" : ""}`}>{l}</span>)}
              <span className={`mono tf__hash${done || hash.length === HASH.length ? " ok" : ""}`}>{done ? HASH : hash}{(done || hash.length === HASH.length) && " ✓ pinned"}</span>
            </span>}
            {i === 3 && <span className="mono tf__count">in <b>{Math.round((done ? 1 : count) * 412)}</b> · out <b>{Math.round((done ? 1 : count) * 86)}</b> tokens</span>}
          </li>
        ))}
      </ol>
      <p className="mono chat__note">Sample request. Prompt, hash and token counts are illustrative.</p>
    </div>
  );
}
