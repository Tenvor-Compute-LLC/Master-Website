"use client";
import { useRef, type CSSProperties } from "react";
import { clamp, useTick } from "@/components/useTick";

const LOOP = 10000;
const DONE = 8600;
// The quickstart's own sample request and abridged response; stage text from /docs "How a request runs".
const PROMPT = "Say hello in one line.";
const REPLY = "Hello! How can I help you today?";
const STAGES = [
  { k: "Request", t: "POST /v1/chat/completions · chat-35b-moe", at: 0 },
  { k: "Routed", t: "To the node best suited for it, among the nodes that have the model loaded.", at: 1800 },
  { k: "On the node", t: "Runs in a sealed container with no internet access.", at: 3200 },
  { k: "Response", t: "", at: 4600 },
  { k: "Receipt", t: "", at: 6800 },
];

/** One API call on the docs: the request goes out, is routed to a node, runs sealed, and the answer comes back with a receipt. */
export default function DocFlow() {
  const box = useRef<HTMLDivElement>(null);
  const e = useTick(box, DONE, LOOP);
  const done = e >= DONE - 400;
  const stage = STAGES.reduce((n, s, i) => (e >= s.at ? i : n), 0);
  const typed = PROMPT.slice(0, Math.round(clamp((e - 200) / 1200) * PROMPT.length));
  const reply = REPLY.slice(0, Math.round(clamp((e - 4800) / 1600) * REPLY.length));
  const n = clamp((e - 7000) / 900);

  return (
    <div ref={box} className="agent tf dflow reveal" aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Your first request</b><span className="mono live"><i className="dot"></i>{done ? "200 OK" : "in flight"}</span></div>
      <p className="mono tf__msg"><span className="tf__lbl">user</span>{done ? PROMPT : typed}{!done && e < 1800 && <span className="chat__caret"></span>}</p>
      <ol className="tf__list" style={{ "--p": done ? 1 : stage / (STAGES.length - 1) } as CSSProperties}>
        {STAGES.map((s, i) => (
          <li key={s.k} className={done || i < stage ? "is-done" : i === stage ? "is-on" : undefined}>
            <span className="mono tf__k">{s.k}</span>
            {i === 3 ? <span className="tf__t dflow__reply">{done ? REPLY : reply}{!done && e >= 4800 && e < 6600 && <span className="chat__caret"></span>}</span>
              : i === 4 ? <span className="mono tf__count">prompt <b>{Math.round((done ? 1 : n) * 14)}</b> · completion <b>{Math.round((done ? 1 : n) * 9)}</b> · total <b>{Math.round((done ? 1 : n) * 23)}</b> tokens</span>
              : <span className="tf__t">{s.t}</span>}
          </li>
        ))}
      </ol>
      <p className="mono chat__note">The quickstart&rsquo;s sample request. Reply and token counts are illustrative.</p>
    </div>
  );
}
