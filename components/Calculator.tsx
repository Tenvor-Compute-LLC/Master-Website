"use client";
import { useEffect, useRef, useState } from "react";
import { Btn, Eyebrow } from "./ui";

const num = (v: number) => Math.round(v).toLocaleString("en-US");
const money = (v: number) => "$" + num(v);
const cents = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Figure that counts to a new value over 450ms, ease-out cubic (as live). Writes the DOM directly per frame. */
function Tween({ value, fmt, id, className }: { value: number; fmt: (v: number) => string; id: string; className?: string }) {
  const el = useRef<HTMLElement>(null);
  const shown = useRef(value);
  const [initial] = useState(() => fmt(value));
  useEffect(() => {
    const node = el.current!, from = shown.current, t0 = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const step = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / 450);
      shown.current = from + (value - from) * (1 - (1 - k) ** 3);
      node.textContent = fmt(shown.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    step(t0);
    return () => cancelAnimationFrame(raf);
  }, [value, fmt]);
  return <strong ref={el} id={id} className={className}>{initial}</strong>;
}

/** Rented GPU vs Tenvor, per month: GPU hours × hourly price vs tokens × blended per-token price. */
const P = 0.137; // USD per 1M tokens, blended from tenvor.io/pricing plan footnote
export default function Calculator() {
  const [g, setG] = useState(730), [r, setR] = useState(0.8), [t, setT] = useState(100);
  const now = g * r, tenvor = t * P;
  return (
    <div className="calc reveal">
      <Eyebrow>Cost of a rented GPU</Eyebrow>
      <label>GPU hours you pay for / month <output id="o-gpu">{g + " h"}</output><input type="range" id="gpu" min="10" max="2920" step="10" value={g} onChange={e => setG(+e.target.value)} /></label>
      <label>Price per GPU-hour <output id="o-rate">{"$" + r.toFixed(2)}</output><input type="range" id="rate" min="0.4" max="5" step="0.05" value={r} onChange={e => setR(+e.target.value)} /></label>
      <label>Tokens served / month <output id="o-tokens">{num(t) + "M"}</output><input type="range" id="tokens" min="1" max="1000" value={t} onChange={e => setT(+e.target.value)} /></label>
      <div className="calc__res">
        <div><small className="mono" style={{ whiteSpace: "nowrap" }}>Rented GPU / month</small><Tween id="r-now" value={now} fmt={money} /></div>
        <div><small className="mono" style={{ whiteSpace: "nowrap" }}>Saved / month</small><Tween id="r-money" className="accent" value={Math.max(0, now - tenvor)} fmt={money} /></div>
      </div>
      <p className="calc__note">With Tenvor: about <b id="r-tenvor">{cents(tenvor)}</b> a month, billed per token, not per idle hour.<br /><small>Alpha: shared capacity, no uptime SLA yet.</small></p>
      <Btn href="#contact" variant="accent" block>Start free, no card</Btn>
    </div>
  );
}
