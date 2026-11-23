"use client";
import { useEffect, useRef, useState } from "react";
import { sample } from "@/content/chat";

const LOOP = 13000;   // ms per run of the sample
const END = LOOP - 700; // the finished frame: shown before hydration, with reduced motion, and while off screen
const words = sample.reply.split(" ");
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** The sample conversation, played as a loop: the question is typed and sent, the reply streams in, then its receipt counts up. */
export default function ChatDemo() {
  const box = useRef<HTMLElement>(null);
  const [e, setE] = useState(END);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0, last = -1;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.floor(((now - t0) % LOOP) / 40) * 40; // 25 fps is plenty for text
      if (t !== last) { last = t; setE(t); }
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([en]) => {
      cancelAnimationFrame(raf);
      if (en.isIntersecting) { t0 = 0; raf = requestAnimationFrame(step); } else setE(END);
    }, { threshold: 0.35 });
    io.observe(box.current!);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const typed = sample.ask.slice(0, Math.round(clamp((e - 300) / 1500) * sample.ask.length));
  const sent = e >= 2000, thinking = e >= 2300 && e < 3300;
  const shown = Math.ceil(clamp((e - 3300) / 2000) * words.length);
  const k = 1 - (1 - clamp((e - 5500) / 900)) ** 3;
  const chips = e >= 5500 ? Math.min(3, Math.floor((e - 5500) / 180) + 1) : 0;
  const rc = [`$${(0.000196 * k).toFixed(6)}`, `${Math.round(1224 * k).toLocaleString("en-US")} tokens`, `${Math.round(52 * k)} tokens`];

  return (
    <figure ref={box} className={`agent chat__win reveal${e > LOOP - 450 ? " is-out" : ""}`}>
      <figcaption className="s-vh">A sample conversation in Chat &amp; Work. You ask: {sample.ask} {sample.model} replies: {sample.reply} Its receipt: a charge of $0.000196, 1,224 prompt tokens and 52 completion tokens.</figcaption>
      <div aria-hidden="true">
        <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Chat &amp; Work</b><span className="mono live"><i className="dot"></i>Sample</span></div>
        <div className="chat__log">
          <div className="chat__ghost"><p className="chat__me">{sample.ask}</p><div className="chat__bot"><p className="mono chat__who">{sample.model}</p><p>{sample.reply}</p><dl className="mono chat__rcpt">{sample.receipt.map(([key, v]) => <div key={key}><dt>{key}</dt><dd>{v}</dd></div>)}</dl></div></div>
          <div className="chat__live">
          {sent && <p className="chat__me">{sample.ask}</p>}
          {sent && <div className="chat__bot">
            <p className="mono chat__who">{sample.model}{thinking && <span className="chat__dots"><i></i><i></i><i></i></span>}</p>
            {shown > 0 && <p>{words.slice(0, shown).join(" ")}{shown < words.length && <span className="chat__caret"></span>}</p>}
            {chips > 0 && <dl className="mono chat__rcpt">{sample.receipt.slice(0, chips).map(([key], i) => <div key={key}><dt>{key}</dt><dd>{rc[i]}</dd></div>)}</dl>}
          </div>}
          </div>
        </div>
        <div className={`chat__box${!sent && typed ? " is-typing" : ""}`}><span>{sent ? "Message" : typed || "Message"}{!sent && e >= 300 && <span className="chat__caret"></span>}</span><span className="mono chat__sw"><i></i>Work</span></div>
      </div>
      <p className="mono chat__note">{sample.note}</p>
    </figure>
  );
}
