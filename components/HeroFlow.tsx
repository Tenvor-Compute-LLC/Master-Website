"use client";
import { useEffect, useRef, useState } from "react";
import { flowLogs, flowSteps } from "@/content/hero";

// S-curve connector lines from each input node to the agent, and from the agent to each output node
function drawWires(f: HTMLElement | null, w: SVGSVGElement | null) {
  if (!f || !w || getComputedStyle(w).display === "none") return;
  const fr = f.getBoundingClientRect(), a = f.querySelector(".agent")!.getBoundingClientRect();
  w.innerHTML = [...f.querySelectorAll<HTMLElement>("[data-wire]")].map((n, i) => {
    const r = n.getBoundingClientRect(), ay = a.top + a.height * (0.35 + (i % 3) * 0.15) - fr.top;
    const out = n.dataset.wire === "out";
    const x1 = (out ? a.right : r.right) - fr.left, y1 = out ? ay : r.top + r.height / 2 - fr.top;
    const x2 = (out ? r.left : a.left) - fr.left, y2 = out ? r.top + r.height / 2 - fr.top : ay, mx = (x1 + x2) / 2;
    const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
    return `<path d="${d}"/>` + (n.classList.contains("node--hot") ? `<path class="hot" d="${d}"/>` : "");
  }).join("");
}

/**
 * Hero diagram: every 2.8s the next input and output light up, the step and log lines
 * change, the progress bar refills, the agent icon pulses, and a DONE badge flashes.
 */
export default function HeroFlow() {
  const [tick, setTick] = useState(0);
  const flow = useRef<HTMLDivElement>(null);
  const wires = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const redraw = () => drawWires(flow.current, wires.current);
    addEventListener("resize", redraw);
    addEventListener("load", redraw);
    document.fonts?.ready.then(redraw);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => { removeEventListener("resize", redraw); removeEventListener("load", redraw); };
    const id = setInterval(() => setTick(t => t + 1), 2800);
    return () => { clearInterval(id); removeEventListener("resize", redraw); removeEventListener("load", redraw); };
  }, []);

  // after each cycle renders: redraw the wires and restart the per-cycle CSS animations
  useEffect(() => {
    drawWires(flow.current, wires.current);
    const f = flow.current;
    if (!f || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  });

  const hotIn = tick % 3, hotOut = (tick + 1) % 3;
  const done = <span className="done mono" aria-hidden="true">Done</span>;
  const node = (dir: "in" | "out", i: number, icon: React.ReactNode, title: string, sub: string) => (
    <div className={`node${(dir === "in" ? hotIn : hotOut) === i ? " node--hot" : ""}`} data-wire={dir}>
      <span className="node__i"><svg viewBox="0 0 24 24">{icon}</svg></span><div><b>{title}</b><small className="mono">{sub}</small></div>{dir === "out" && done}
    </div>
  );

  return (
    <div className="flow reveal" ref={flow}>
      <svg className="flow__wires" aria-hidden="true" ref={wires}></svg>
      <div className="flow__grid">
        <div className="flow__col">
          {node("in", 0, <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />, "API request", "/v1/chat · OpenAI API")}
          {node("in", 1, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>, "SDK job", "Python · chat-35b-moe")}
          {node("in", 2, <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01" /></>, "Web console", "Chat · Qwen 3.6 35B")}
        </div>
        <div className="agent">
          <div className="agent__top"><span className="agent__ico"><svg viewBox="0 0 24 24"><path d="M6 10v4M10 7v10M14 9v6M18 11v2" /></svg></span><b>Tenvor Orchestrator</b><span className="mono live"><i className="dot"></i>Running</span></div>
          <p className="mono agent__log"><span className="accent">→</span>{" " + flowSteps[tick % 5]}</p>
          <div className="bar"><span></span></div>
          <div className="tags mono"><span>Routing</span><span>Scheduler</span><span>Sandbox</span><span>Metering</span></div>
        </div>
        <div className="flow__col">
          {node("out", 0, <><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>, "Operator GPU", "NVIDIA · 10 GB+")}
          {node("out", 1, <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></>, "Free node", "Sealed · no network")}
          {node("out", 2, <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />, "Response", "Streamed · 35+ tok/s")}
        </div>
      </div>
      <div className="flow__foot mono">
        <span><i className="dot"></i>{flowLogs[tick % 5]}</span>
        <span className="flow__stats">Context <b>64K</b> · Tested <b>35+ tok/s</b> · Input <b>$0.126 / 1M</b></span>
      </div>
    </div>
  );
}
