"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { contactHref, pricingTabs } from "@/content/pricing";
import Head from "./Head";
import { Btn } from "./ui";

export default function Pricing() {
  const [tab, setTab] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (i: number) => { if (i !== tab) { setTab(i); setSwapped(true); } };
  const onKey = (e: KeyboardEvent) => {
    const n = pricingTabs.length;
    const next = { ArrowRight: (tab + 1) % n, ArrowLeft: (tab - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };
  const cur = pricingTabs[tab];

  return (
    <section className="sec" id="pricing">
      <div className="wrap">
        <Head num="09" eyebrow="Pricing" title="Pay monthly or per token." side="Pick a monthly plan, or pay as you go. New accounts start with $0.25 of free credit; failed requests cost $0." />
        <div className="ptabs mono" role="tablist" aria-label="Pricing options" onKeyDown={onKey}>
          {pricingTabs.map((t, i) => (
            <button key={t.id} ref={el => { tabRefs.current[i] = el; }} type="button" role="tab" id={`ptab-${t.id}`}
              aria-selected={i === tab} aria-controls="ppanel" tabIndex={i === tab ? 0 : -1} onClick={() => select(i)}>{t.label}</button>
          ))}
        </div>
        {/* Remounted per tab so the swap animation replays; after a swap the cards skip the scroll reveal, the section is already on screen. */}
        <div className={`grid3${swapped ? " grid3--swap" : ""}`} role="tabpanel" id="ppanel" aria-labelledby={`ptab-${cur.id}`} key={cur.id}>
          {cur.plans.map(p => (
            <div className={`plan${p.hot ? " plan--hot" : ""} reveal${swapped ? " in" : ""}`} key={p.name}>
              <h4>{p.name}{p.tag && <> <span className="tag mono">{p.tag}</span></>}</h4>
              <p className="mono sub">{p.sub}</p>
              <p className="amt">{p.amount}{p.per && <small className="mono">{p.per}</small>}</p>
              <p>{p.blurb}</p>
              <ul>{p.features.map(f => <li key={f}><svg aria-hidden="true"><use href="#i-check" /></svg>{f}</li>)}</ul>
              <Btn href={p.href} variant={p.hot ? "accent" : "ghost"} block>{p.cta}</Btn>
            </div>
          ))}
        </div>
        <p className="mono ptabs__note">Teams &amp; Enterprise? <a href={contactHref}>Contact us →</a></p>
      </div>
    </section>
  );
}
