"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { code, receipt } from "@/content/developers";

const RUN = 8000;  // ms per tab: type the code, return the receipt, hold
const DONE = 7900; // the finished frame: before hydration, with reduced motion, and while off screen
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const KW = /^(import|from|const|new|await|curl)$/;

/** Light syntax colouring: strings green, a few keywords orange. */
function hl(line: string): ReactNode {
  return line.split(/("[^"]*"|'[^']*'?)/).map((part, i) =>
    /^["']/.test(part) ? <span key={i} className="d-s">{part}</span>
      : part.split(/(\b[a-z]+\b)/).map((w, j) => KW.test(w) ? <span key={`${i}-${j}`} className="d-jk">{w}</span> : <Fragment key={`${i}-${j}`}>{w}</Fragment>));
}

/** Hero console: the request in each SDK types itself, then the receipt comes back; tabs cycle until someone picks one. */
export default function DevConsole() {
  const box = useRef<HTMLDivElement>(null);
  const auto = useRef(true);
  const [tab, setTab] = useState(0);
  const [e, setE] = useState(DONE);
  const restart = useRef<() => void>(() => {});

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0, last = -1, on = false;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const t = now - t0;
      if (t >= RUN) {
        if (auto.current) { setTab(x => (x + 1) % code.length); t0 = now; }
        else { setE(DONE); return; }
      }
      const q = Math.floor((now - t0) / 40) * 40;
      if (q !== last) { last = q; setE(q); }
      raf = requestAnimationFrame(step);
    };
    restart.current = () => { cancelAnimationFrame(raf); if (on) { t0 = 0; raf = requestAnimationFrame(step); } };
    const io = new IntersectionObserver(([en]) => {
      on = en.isIntersecting;
      cancelAnimationFrame(raf);
      if (on) { t0 = 0; raf = requestAnimationFrame(step); } else setE(DONE);
    }, { threshold: 0.35 });
    io.observe(box.current!);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const pick = (i: number) => { auto.current = false; setTab(i); restart.current(); };
  const cur = code[tab];
  const lines = Math.ceil(clamp((e - 200) / (cur.lines.length * 110)) * cur.lines.length);
  const ok = e >= 2200;
  const rows = e >= 2600 ? Math.min(receipt.length, Math.floor((e - 2600) / 260) + 1) : 0;
  const k = 1 - (1 - clamp((e - 2600) / 1100)) ** 3;
  const money = (v: string) => v ? "$" + (parseFloat(v.slice(1)) * k).toFixed(6) : v;

  return (
    <div ref={box} className="agent dev__con reveal">
      <div className="dev__tabs mono" role="tablist" aria-label="Request samples">
        {code.map((c, i) => <button key={c.id} type="button" role="tab" aria-selected={i === tab} onClick={() => pick(i)}>{c.label}</button>)}
        <span className="dev__file">{cur.file}</span>
      </div>
      <pre className="dev__code" aria-label={`${cur.label} sample`}><code>
        {cur.lines.map((l, i) => <span key={`${cur.id}${i}`} className={`dev__ln${i < lines ? " on" : ""}`}>{hl(l)}{i === lines - 1 && lines < cur.lines.length && <span className="chat__caret"></span>}{"\n"}</span>)}
      </code></pre>
      <div className="dev__out">
        <p className="mono dev__st"><span className={`dev__ok${ok ? " on" : ""}`}><i className="dot"></i>200 OK</span><span>Receipt</span></p>
        <table className="mono dev__rc"><caption className="s-vh">The receipt for this response, in dollars</caption><tbody>
          {receipt.map(([a, b, c, d], i) => <tr key={a} className={i < rows ? "on" : undefined}><th scope="row">{a}</th><td>{b}</td><td className="dev__rate">{c}</td><td>{i < rows ? money(d) : d}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
