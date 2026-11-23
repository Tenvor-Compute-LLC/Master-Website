"use client";
import { useRef, type CSSProperties } from "react";
import { topics } from "@/lib/contact";
import { clamp, useTick } from "@/components/useTick";

const EACH = 2600;
const LOOP = EACH * topics.length;

/** Where a message goes: any topic from the form, emailed to support@tenvor.io, answered by email. */
export default function ContactFlow() {
  const box = useRef<HTMLDivElement>(null);
  const e = useTick(box, EACH - 200, LOOP);
  const t = e % EACH, label = topics[Math.floor(e / EACH) % topics.length].label;
  const typed = label.slice(0, Math.round(clamp(t / 900) * label.length));
  const stage = t < 1100 ? 0 : t < 1800 ? 1 : 2;
  return (
    <div ref={box} className="agent tf reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Your message</b><span className="mono live"><i className="dot"></i>{stage === 2 ? "delivered" : "sending"}</span></div>
      <p className="mono tf__msg"><span className="tf__lbl">topic</span>{typed}{stage === 0 && <span className="chat__caret"></span>}</p>
      <ol className="tf__list" style={{ "--p": stage / 2 } as CSSProperties}>
        {[["Form", "Name, email, topic and your message."], ["Sent to", "support@tenvor.io"], ["Reply", "By email, or by phone if you ask for it."]].map(([k, v], i) => (
          <li key={k} className={i < stage || stage === 2 ? "is-done" : i === stage ? "is-on" : undefined}><span className="mono tf__k">{k}</span><span className="tf__t">{v}</span></li>
        ))}
      </ol>
      <p className="mono chat__note">The topics are the ones in the form below.</p>
    </div>
  );
}
