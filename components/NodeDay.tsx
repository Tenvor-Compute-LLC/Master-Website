"use client";
import { clamp, useLoop } from "./opsLoop";
import "@/app/styles/anim-ops.css";

const LOOP = 12400;
const DONE = 9800; // settled frame: set up, tested, serving its second request
// Phases follow the page's own text (tenvor.io/operators): set up, speed test, then "it waits, it works, you pause it".
const PHASES = [
  { at: 0, s: "setting up", t: "Fetching the model and a sealed GPU runtime." },
  { at: 2400, s: "speed test", t: "The app times your PC." },
  { at: 3800, s: "ready", t: "Waiting for work. It arrives as demand does." },
  { at: 4800, s: "working", t: "Serving one request at a time." },
  { at: 7600, s: "ready", t: "Waiting for work. It arrives as demand does." },
  { at: 8600, s: "working", t: "Serving one request at a time." },
  { at: 10800, s: "paused", t: "Paused from the tray icon. No new work until you resume." },
];
const TOKS = [[4800, 7400, 0, 318], [8600, 10600, 318, 542]] as const; // [start, end, from, to]

/** One node's first hour and an ordinary day: download, speed test, then waiting, serving and paused. */
export default function NodeDay() {
  const [box, e] = useLoop(LOOP, DONE);
  const p = PHASES.reduce((n, s, i) => (e >= s.at ? i : n), 0);
  const { s: state } = PHASES[p];
  const gb = Math.round(clamp(e / 2200) * 22);
  const speed = Math.round(clamp((e - 2400) / 1100) * 41);
  const serving = state === "working";
  const vram = serving ? 86 : state === "paused" ? 6 : 12;
  const toks = Math.round(TOKS.reduce((n, [a, b, f, t]) => (e >= a ? f + (t - f) * clamp((e - a) / (b - a)) : n), 0));

  return (
    <div ref={box} className="agent nd reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Tenvor Node</b><span className={`mono live nd__st nd__st--${state.replace(" ", "-")}`}><i className="dot"></i>{state}</span></div>
      <p className="mono nd__gpu">RTX 3080 · 10 GB · 32 GB memory</p>
      <div className="nd__rows">
        <div className="nd__row"><span className="mono nd__k">model</span><span className="nd__bar"><i style={{ width: `${(gb / 22) * 100}%` }}></i></span><span className="mono nd__v">{gb === 22 ? "22 GB ✓" : `${gb} / 22 GB`}</span></div>
        <div className="nd__row"><span className="mono nd__k">speed</span><span className="nd__bar nd__bar--mark"><i style={{ width: `${(speed / 50) * 100}%` }}></i><u style={{ left: "70%" }}></u></span><span className={`mono nd__v${speed >= 35 ? " ok" : ""}`}>{e < 2400 ? "—" : `${speed} tok/s${speed >= 35 ? " ✓" : ""}`}</span></div>
        <div className="nd__row"><span className="mono nd__k">video mem</span><span className="nd__bar nd__bar--vram"><i style={{ width: `${e < 3800 ? 4 : vram}%` }}></i></span><span className="mono nd__v">{e < 3800 ? "—" : serving ? "model loaded" : "idle"}</span></div>
      </div>
      <p className="nd__msg">{PHASES[p].t}</p>
      <div className="mono nd__earn"><span>tokens served <b>{toks}</b></span><span>earnings accrue · payouts not open yet</span></div>
      <p className="mono chat__note">Sample node. The card, speed and token counts are illustrative.</p>
    </div>
  );
}
