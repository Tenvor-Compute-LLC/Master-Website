"use client";
import { useEffect, useRef } from "react";
import { clients } from "@/content/hero";

/** Logo ticker: live scrolls at 40 px/s and slows to 40% speed while hovered. */
export default function LogoMarquee() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = track.current!;
    const setSpeed = () => { t.style.animationDuration = t.scrollWidth / 2 / 40 + "s"; };
    setSpeed();
    addEventListener("load", setSpeed);
    document.fonts?.ready.then(setSpeed);
    return () => removeEventListener("load", setSpeed);
  }, []);
  const rate = (r: number) => track.current?.getAnimations().forEach(a => { a.playbackRate = r; });
  return (
    <div className="wrap logos">
      <p className="mono logos__label">Ecosystem</p>
      <div className="marquee">
        <div className="marquee__track" ref={track} onMouseEnter={() => rate(0.4)} onMouseLeave={() => rate(1)}>
          {[0, 1].map(k => clients.map(c => <span key={c.name + k} aria-hidden={k ? true : undefined}>{c.logo && <img src={c.logo} alt="" />}{c.name}</span>))}
        </div>
      </div>
    </div>
  );
}
