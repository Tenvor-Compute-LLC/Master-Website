"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const LOOP = 13000;
const DONE = 11600; // the settled frame: before hydration, with reduced motion, and while off screen
// All wording is the Security Reporting Policy's own (tenvor.io/legal/security): In scope, Out of scope, How to report, Tenvor's response, Safe harbor.
const SCOPE = [
  { t: "tenvor.io and Tenvor API hosts", in: true },
  { t: "public worker/node release", in: true },
  { t: "account separation", in: true },
  { t: "denial of service", in: false },
  { t: "social engineering", in: false },
  { t: "third-party systems", in: false },
];
const FIELDS = ["affected host, release or component", "vulnerability type and impact", "safe reproduction steps", "request/job IDs, no prompt content", "whether data or an account is exposed", "contact and disclosure timeline", "encrypted channel before secrets"];
const STOPS = [
  { k: "Acknowledge", t: "within five business days", at: 7300 },
  { k: "Status update", t: "within 30 days", at: 8600 },
  { k: "Remediate + disclose", t: "coordinated by severity", at: 9900 },
];
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** One report through the policy: checked against scope, written to security@tenvor.io, then answered on the published targets. */
export default function ReportFlow() {
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

  const scoped = Math.floor(clamp((e - 200) / 2000) * SCOPE.length + 0.001);
  const filled = Math.floor(clamp((e - 2800) / 3300) * FIELDS.length + 0.001);
  const sent = e >= 6400;
  const p = clamp((e - 6400) / 3500);
  const reached = STOPS.filter(s => e >= s.at).length;
  const harbor = e >= 10800;
  const status = harbor ? "safe harbor" : reached ? STOPS[reached - 1].k.toLowerCase() : sent ? "sent" : e >= 2600 ? "writing report" : "checking scope";

  return (
    <div ref={box} className="agent rf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>One report</b><span className="mono live"><i className="dot"></i>{status}</span></div>
      <p className="mono rf__find"><span className="rf__lbl">finding</span>account-separation bug</p>

      <div className={`rf__step${e >= 2600 ? " is-done" : " is-on"}`}>
        <p className="mono rf__k">1 · Scope</p>
        <ul className="rf__scope">
          {SCOPE.map((s, i) => <li key={s.t} className={`mono${i < scoped ? (s.in ? " in" : " out") : ""}`}>{i < scoped && (s.in ? "✓ " : "✕ ")}{s.t}</li>)}
        </ul>
        <p className="mono rf__sub">✕ = out of scope without written permission</p>
      </div>

      <div className={`rf__step${sent ? " is-done" : e >= 2600 ? " is-on" : ""}`}>
        <p className="mono rf__k">2 · Email security@tenvor.io{sent && <span className="rf__sent"> · sent</span>}</p>
        <ol className="rf__fields">
          {FIELDS.map((f, i) => <li key={f} className={i < filled ? "on" : undefined}>{f}</li>)}
        </ol>
      </div>

      <div className={`rf__step${harbor ? " is-done" : sent ? " is-on" : ""}`}>
        <p className="mono rf__k">3 · Tenvor’s response</p>
        <div className="rf__track" style={{ "--p": p } as CSSProperties}>
          {STOPS.map((s, i) => <div key={s.k} className={`rf__stop${i < reached ? " on" : ""}`}><b>{s.k}</b><span className="mono">{s.t}</span></div>)}
        </div>
      </div>

      <p className={`rf__harbor${harbor ? " on" : ""}`}>Policy followed in good faith: Tenvor will not initiate legal action for the authorized research.</p>
      <p className="mono chat__note">Sample finding, illustrative. Response times are targets, not a service-level agreement.</p>
    </div>
  );
}
