"use client";
import { clamp, useLoop } from "./opsLoop";
import "@/app/styles/anim-ops.css";

const LOOP = 11200;
const DONE = 9600; // settled frame: switched on, ten contributions done, at the 5% cap
const ON = 1400, RUN = 1800, EACH = 700, N = 10; // 10 × 0.5% reaches the 5% cap

/** The planned Compute for Good setting: off by default, switched on locally, server-issued unpaid contributions that raise trust up to a cap. */
export default function GoodFlow() {
  const [box, e] = useLoop(LOOP, DONE);
  const on = e >= ON;
  const done = e < RUN ? 0 : Math.min(N, Math.floor((e - RUN) / EACH));
  const cur = done < N && e >= RUN ? done + 1 : 0;
  const prog = cur ? clamp(((e - RUN) % EACH) / (EACH * 0.8)) : 0;
  const capped = done === N;

  return (
    <div ref={box} className="agent gf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Compute for Good</b><span className="mono live gf__plan">planned</span></div>
      <div className="gf__set">
        <span><b>Donate idle compute</b><small className="mono">{on ? "on · switched on locally" : "off by default"}</small></span>
        <span className={`gf__sw${on ? " on" : ""}`} role="presentation"><i></i></span>
      </div>
      <div className="gf__job">
        <span className="mono gf__k">{!on ? "no donated work" : cur ? `contribution ${cur} · issued by Tenvor` : capped ? "multiplier at its cap" : "waiting for an issued job"}</span>
        <span className="nd__bar"><i style={{ width: `${(capped ? 1 : prog) * 100}%` }}></i></span>
        <span className="mono gf__sub">approved text processing · unpaid</span>
      </div>
      <div className="gf__trust">
        <span className="mono gf__k">trust multiplier</span>
        <span className="gf__segs">{Array.from({ length: N }, (_, i) => <i key={i} className={i < done ? "on" : undefined}></i>)}</span>
        <span className="mono gf__v"><b>+{(done * 0.5).toFixed(1)}%</b>{capped ? " · capped, rolling 7 days" : " · +0.5% each"}</span>
      </div>
      <div className="mono gf__pay"><span>operator payout</span><b>none · a donation</b></div>
      <p className="mono chat__note">Illustration of the planned setting; donated work does not reach nodes yet.</p>
    </div>
  );
}
