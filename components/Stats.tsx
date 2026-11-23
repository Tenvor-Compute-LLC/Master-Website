import "@/app/styles/anim-docs.css";
import CountUp from "./CountUp";
import { stats } from "@/content/stats";
import { Arrow, Eyebrow, H2 } from "./ui";

export default function Stats() {
  return (
    <section className="sec" id="why">
      <div className="wrap split">
        <div className="reveal">
          <Eyebrow num="02">Why Tenvor</Eyebrow>
          <H2>Open models. Per-token prices. No black boxes.</H2>
          <p className="lead">Every request that completes comes with an itemised receipt: tokens in, tokens out and the charge. You pay for tokens, not idle GPU time.</p>
          <a href="/about" className="link">Meet the team <Arrow className="accent" /></a>
        </div>
        <div className="stats reveal">
          {stats.map(s => <div key={s.label}><b className={s.accent ? "accent" : undefined}><CountUp value={s.value} /></b><small className="mono">{s.label}</small></div>)}
        </div>
      </div>
    </section>
  );
}
