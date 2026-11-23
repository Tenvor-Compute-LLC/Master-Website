"use client";
import { useRef, type CSSProperties } from "react";
import { useLoop } from "@/components/useLoop";
import "@/app/styles/anim-status.css";

const LOOP = 10000;
const DONE = 8600;
// Wording from the Status page itself (tenvor.io/status): its intro, notice card and Published surfaces table.
const SURFACES = [
  { s: "/v1/chat/completions", r: "Manual coordination; no SLA" },
  { s: "/api/catalog/public", r: "Reachability is not an uptime guarantee" },
  { s: "Operator node manager", r: "Local diagnostics plus manual coordination" },
];
const STEPS = [
  { k: "Known incident", t: "No automated public incident feed is available yet.", at: 0 },
  { k: "Coordinated", t: "Manually, with affected alpha users and operators.", at: 2000 },
  { k: "Posted here", t: "Qualifying outages under the refund policy.", at: 4200 },
  { k: "No notice", t: "Absence of a notice does not prove API or worker availability.", at: 6400 },
];

/** How an incident is reported today: one sample incident on a published surface, walked through the manual path. */
export default function StatusFlow() {
  const box = useRef<HTMLDivElement>(null);
  const e = useLoop(box, LOOP, DONE);
  const done = e >= DONE - 400;
  const step = STEPS.reduce((n, s, i) => (e >= s.at ? i : n), 0);
  const hit = !done && e >= 300 && e < 6400; // the sample incident sits on the API row until it is reported

  return (
    <div ref={box} className="agent sf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Incident reporting</b><span className="mono live"><i className="dot"></i>manual</span></div>
      <ul className="sf__rows">
        {SURFACES.map((x, i) => (
          <li key={x.s} className={hit && i === 0 ? "is-hit" : undefined}>
            <span className="mono sf__s">{x.s}</span>
            <span className="sf__r">{hit && i === 0 ? "sample incident" : x.r}</span>
          </li>
        ))}
      </ul>
      <ol className="tf__list" style={{ "--p": done ? 1 : step / (STEPS.length - 1) } as CSSProperties}>
        {STEPS.map((s, i) => (
          <li key={s.k} className={done || i < step ? "is-done" : i === step ? "is-on" : undefined}>
            <span className="mono tf__k">{s.k}</span>
            <span className="tf__t">{s.t}</span>
          </li>
        ))}
      </ol>
      <p className="mono chat__note">Sample incident, illustrative. No uptime, response-time or incident-response target is offered.</p>
    </div>
  );
}
