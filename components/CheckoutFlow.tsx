"use client";
import { useRef } from "react";
import { useLoop } from "@/components/useLoop";
import type { plans } from "@/content/pages/checkout";
import "@/app/styles/anim-status.css";

type Plan = (typeof plans)[keyof typeof plans];
const WEEK = 2400, DRAIN = 1800;
const LOOP = 4 * WEEK + 2000;
const DONE = 4 * WEEK + 800;
const USED = [0.7, 0.9, 0.5, 0.8]; // illustrative share of each week's allowance used
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

/** The plan's month as the checkout text describes it: four equal weeks, a fresh allowance each, half of what is left rolling over. */
export default function CheckoutFlow({ plan }: { plan: Plan }) {
  const box = useRef<HTMLDivElement>(null);
  const e = useLoop(box, LOOP, DONE);
  const done = e >= 4 * WEEK;
  const w = Math.min(3, Math.floor(e / WEEK));
  const t = done ? WEEK : e - w * WEEK;
  const cents = Math.round(parseFloat(plan.week.slice(1)) * 100);
  const roll = (i: number) => Math.round(cents * (1 - USED[i]) / 2);
  const left = cents * (1 - USED[w] * clamp(t / DRAIN));
  const moving = clamp((t - DRAIN) / (WEEK - DRAIN - 200)); // this week's rollover, on its way
  const rolled = USED.slice(0, w).reduce((s, _, i) => s + roll(i), 0) + Math.round(roll(w) * moving);

  return (
    <div ref={box} className="agent ckf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>{plan.name} · one month</b><span className="mono live"><i className="dot"></i>{done ? "renews" : `week ${w + 1} of 4`}</span></div>
      <ol className="ckf__weeks">
        {USED.map((_, i) => <li key={i} className={done || i < w ? "is-done" : i === w ? "is-on" : undefined}><span className="mono">Week {i + 1}</span><b className="mono">{plan.week}</b></li>)}
      </ol>
      <div className="ckf__row"><span className="mono tf__k">This week&rsquo;s allowance</span><span className="mono ckf__v">{usd(Math.round(left - roll(w) * moving))} left of {plan.week}</span></div>
      <div className="ckf__bar"><i style={{ width: `${((left - roll(w) * moving) / cents) * 100}%` }} /><i className="ckf__out" style={{ width: `${(roll(w) * moving / cents) * 100}%` }} /></div>
      <div className="ckf__row"><span className="mono tf__k">Rollover credit</span><span className="mono ckf__v ckf__roll">+{usd(rolled)}</span></div>
      <p className="ckf__t">Half of what a week leaves unused is added as rollover credit. It expires 90 days after it is added.</p>
      <p className="mono ckf__order"><span>week&rsquo;s allowance</span>→<span>rollover credit</span>→<span>bought credit</span></p>
      <p className="ckf__t">Plus {plan.msgs} chat messages a week with Tenvor-35B, outside the allowance. Renews every month, on the day you start.</p>
      <p className="mono chat__note">Usage each week is illustrative. Plan amounts are from the order summary.</p>
    </div>
  );
}
