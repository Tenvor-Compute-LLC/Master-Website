"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Monitor, Status } from "@/lib/uptime";

const SLOTS = 60;
const WORD = ["Down", "Up", "Pending", "Maintenance"];

function overall(ms: Monitor[]): [string, string] {
  if (!ms.length) return ["No monitors published yet", "pend"];
  const down = ms.filter(m => m.status === 0).length;
  if (down === ms.length) return ["Major outage", "down"];
  if (down) return ["Partial outage", "down"];
  if (ms.some(m => m.status === 3)) return ["Scheduled maintenance", "maint"];
  if (ms.every(m => m.status === 1)) return ["All systems operational", "up"];
  return ["Checking", "pend"];
}
const cls = (s: number) => ["down", "up", "pend", "maint"][s] ?? "pend";
const pct = (u: number | null) => (u === null ? "–" : `${(u * 100).toFixed(u >= 0.9999 ? 0 : 2)}%`);

/** Live board fed by Uptime Kuma via /api/status; refreshes every minute while the tab is visible. */
export default function LiveStatus({ initial }: { initial: Status }) {
  const [st, setSt] = useState(initial);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") fetch("/api/status").then(r => r.json()).then(setSt).catch(() => {}); };
    const id = window.setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (st.state !== "ok") return (
    <div className="ls ls--wait reveal">
      <p className="ls__head"><i className="ls__dot ls--pend"></i><b>{st.state === "unconfigured" ? "Live monitoring is being connected." : "The status monitor could not be reached."}</b></p>
      <p className="ls__sub">{st.state === "unconfigured" ? "Service checks will appear here as soon as our monitors are online." : "This is a problem reaching our monitor, not a statement about the service. The page retries every minute."}</p>
    </div>
  );

  const all = st.groups.flatMap(g => g.monitors), [label, tone] = overall(all);
  return (
    <div className="ls reveal">
      <p className={`ls__head ls--${tone}`}><i className={`ls__dot ls--${tone}`}></i><b>{label}</b><span className="mono ls__time">checked {new Date(st.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></p>
      {st.incident && <div className="ls__inc"><b>{st.incident.title}</b><p>{st.incident.content}</p></div>}
      {st.groups.map(g => (
        <div className="ls__group" key={g.name}>
          {g.name && <p className="mono ls__k">{g.name}</p>}
          {g.monitors.map(m => (
            <div className="ls__row" key={m.id}>
              <div className="ls__top"><i className={`ls__dot ls--${cls(m.status)}`}></i><b>{m.name}</b><span className="mono ls__up">{pct(m.uptime)} <small>24 h</small></span></div>
              <div className="ls__beats" role="img" aria-label={`${m.name}: ${WORD[m.status] ?? "Unknown"} now, ${pct(m.uptime)} up over 24 hours`}>
                {Array.from({ length: SLOTS - m.beats.length }, (_, i) => <i key={`e${i}`} className="ls--none"></i>)}
                {m.beats.map((b, i) => <i key={i} className={`ls--${cls(b.s)}`} style={{ "--i": i } as CSSProperties} title={`${WORD[b.s] ?? "Unknown"} · ${b.t}${b.p !== null ? ` · ${b.p} ms` : ""}`}></i>)}
              </div>
              <p className="mono ls__axis"><span>{m.beats.length ? "older" : ""}</span><span>now</span></p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
