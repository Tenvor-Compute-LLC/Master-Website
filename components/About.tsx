"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { about } from "@/content/about";
import Head from "./Head";
import { AirbnbLine, Eyebrow } from "./ui";

// World dot map: rough continent outlines as [lon, lat] polygons, sampled on a 3° grid. Accuracy is a dot map's, not an atlas's.
const LAND: number[][][] = [
  [[-168,66],[-162,70],[-156,71.5],[-140,70],[-128,70.5],[-115,68],[-95,72],[-82,73],[-80,63],[-94,59],[-90,56],[-80,52],[-78,60],[-70,59],[-64,60],[-56,52],[-60,47],[-66,44],[-70,42],[-74,40],[-76,35],[-81,31],[-80,25.5],[-82,28],[-85,30],[-90,29.5],[-97,27],[-97.5,22],[-95,18.5],[-91,19],[-87,21],[-88,16],[-83.5,15],[-83,10],[-79,9],[-77.5,8],[-81,7.5],[-86,11.5],[-92,14.5],[-96,16],[-105,20],[-106,23.5],[-112,29],[-114.5,31.5],[-112,26],[-110,23],[-112.5,24.5],[-115,28],[-117,32.5],[-121,35],[-124,40],[-124,46],[-123,49],[-128,51],[-133,55],[-137,58.5],[-146,60.5],[-152,59],[-158,57],[-165,54.5],[-158,59],[-162,60],[-166,62],[-164,64]],
  [[-120,77],[-85,80],[-70,80],[-62,72],[-66,66],[-75,64],[-80,70],[-95,72],[-118,71]],
  [[-73,78],[-60,82],[-30,83.5],[-20,81],[-18,76],[-22,70],[-32,68],[-42,60],[-48,61],[-53,66],[-55,70],[-60,76],[-68,77]],
  [[-85,22],[-80,23],[-74,20],[-78,20]],
  [[-80,9],[-72,12],[-62,10.5],[-52,5],[-50,0],[-44,-2.5],[-35,-5],[-35,-9],[-39,-14],[-40,-21],[-48,-26],[-53,-34],[-58,-38],[-62,-41],[-65,-45],[-68,-50],[-69,-55],[-74,-52],[-74,-45],[-73,-37],[-71.5,-30],[-70,-18],[-76,-14],[-81,-6],[-80,-2],[-80,1],[-77,4],[-77.5,7.5]],
  [[-10,36],[-9,43],[-2,43.5],[-1.5,46],[-4.5,48.5],[2,51],[5,53.5],[8.5,57],[10.5,54],[14,54],[20,54.8],[21,57],[24,57.5],[23,59.5],[28,60],[23,62],[25,65.5],[21,64],[17,61],[19,60],[16,56.5],[13,55.5],[11,58.5],[5.5,58.5],[5,62],[13,66],[18,69.5],[26,71],[31,70],[40,67],[44,68.5],[54,68.5],[60,69],[60,55],[50,46],[47,42],[41.5,41.5],[36,41],[29,41],[26,40],[26,38],[23,36.5],[20,40],[19,42.5],[14,45.5],[12.5,44],[18.5,40],[15.5,38],[12.5,41.5],[8.5,44.3],[3,43.3],[3,42],[0,39],[-1,37.5],[-5.5,36]],
  [[-5.5,50],[1.5,51],[1.5,53],[-1.5,55.5],[-2,57.5],[-3,58.7],[-5,58.6],[-6,56.5],[-5,54.5],[-3,54],[-4.5,53],[-5,51.5]],
  [[-10,51.5],[-6,52],[-6,54],[-8,55.3],[-10,54]],
  [[-24,65.5],[-18,66.5],[-13.5,65],[-18,63.4],[-22,63.8]],
  [[-17,21],[-17,15],[-12,7],[-8,4.5],[-2,5],[5,6],[9,4],[9.5,1],[12,-5],[13.5,-12],[12,-17],[15,-27],[18.5,-34.5],[22,-34],[27,-33.5],[32,-28.5],[35.5,-24],[35,-20],[40.5,-15],[40,-10],[39,-5],[42,-1],[51,11.5],[44,11],[43,12.5],[39,16],[37,19],[34,26.5],[32.5,30],[29,31],[20,32],[19.5,30.5],[15.5,31.5],[10.5,34],[11,37],[3,36.8],[-2,35],[-6,35.8],[-9.5,30],[-13,27.5]],
  [[44,-25],[47,-25],[50.5,-15.5],[49,-12],[44,-17]],
  [[34.5,28],[35,32],[39,32],[48,30],[50,26.5],[51.5,24],[56,26],[59.5,22.5],[55,17],[52,16],[43,12.5],[42.5,16],[39,21],[36.5,25.5]],
  [[60,55],[60,69],[69,73],[80,73.5],[87,75],[100,78],[105,77.5],[113,74],[130,71],[140,72.5],[150,71],[160,69.5],[170,70],[180,68.5],[190,66],[187,64.5],[180,62.5],[173,60],[163,59.5],[162,55],[156,51],[156,57],[160,61.5],[154,59],[143,59.5],[137,54],[141,52],[140,47],[135,43],[130,42.5],[129,35],[126.5,34.5],[126,38],[124.5,40],[121,40.5],[122,37],[119,35],[122,31],[121.5,28],[117,23.5],[110,21],[108,21.5],[106,19],[109,15],[109,11.5],[105,8.6],[103,10.5],[100.5,13.5],[100,7],[103.5,1.3],[101,3],[98,8],[98.5,16],[94,18],[92,22],[88,22],[86.5,20],[80,15.5],[80,10],[77.5,8],[73,17],[72.5,21.5],[67,24.8],[62,25],[57,27],[54,26.8],[50,30],[48,30],[39,32],[35,32],[36,36],[30,36.5],[27,37],[26.5,40],[29,41],[36,41],[41.5,41.5],[47,42],[50,46]],
  [[130,31],[132,34],[135,34],[140,35],[141,38],[142,41],[141.5,45.5],[145.5,44],[143,42],[140,41],[139.5,38],[137,37],[133,35.5],[130,33.8]],
  [[120,18.5],[122.5,18.5],[124,12.5],[126,7],[125,6],[122,7],[120,14]],
  [[95,5.5],[98,4],[106,-6],[104,-5.5],[100,-1]],
  [[105,-6],[114.5,-7],[114,-8.5],[106,-7.5]],
  [[109,1.5],[111,-3],[116,-4],[118.5,1],[117,7],[115,5],[110,2]],
  [[131,-1],[141,-2.5],[150,-10.5],[143,-9],[138,-8],[132,-4]],
  [[113,-22],[114,-26.5],[115,-34],[118,-35],[124,-33.8],[129,-31.6],[134,-32.5],[138,-35],[140,-38],[146,-39],[150,-37.5],[153.5,-28],[153,-25],[146,-19],[143,-10.8],[141.5,-13],[141,-17],[136,-15],[137,-12],[132,-11],[129.5,-15],[125,-14.5],[122,-18],[114,-21.8]],
  [[172.5,-34.5],[178.5,-37.5],[175,-41.5],[171,-44.5],[166.5,-46],[168,-44],[172.5,-41],[174.5,-38.5]],
];
const inPoly = (x: number, y: number, p: number[][]) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  return inside;
};
const COLS = 120, ROWS = 46;
// Land dots in a fixed pseudo-random order (seeded, so server and client agree): index = the order they come online.
const DOTS = (() => {
  const d: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (LAND.some(p => inPoly(-169 + c * 3, 81 - r * 3, p))) d.push([c, r]);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
})();

const clamp = (v: number) => Math.max(0, Math.min(1, v));

function Story() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = root.current!, cv = canvas.current!, ctx = cv.getContext("2d")!;
    const steps = [...el.querySelectorAll<HTMLElement>(".about__step")];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = matchMedia("(min-width: 901px)");
    const N = DOTS.length;
    let cur = reduce ? N : 0, target = cur, raf = 0;

    const draw = () => {
      const w = cv.width, h = cv.height, u = w / COLS;
      ctx.clearRect(0, 0, w, h);
      const lit = Math.round(cur);
      for (let i = 0; i < N; i++) {
        const [c, r] = DOTS[i], x = (c + 0.5) * u, y = (r + 0.5) * u;
        if (i < lit && i >= lit - 28 && lit < N) { // the newest few flare as they come online
          ctx.fillStyle = "rgba(255,90,31,.22)";
          ctx.beginPath(); ctx.arc(x, y, u * 0.95, 0, 7); ctx.fill();
        }
        ctx.fillStyle = i < lit ? "#ff5a1f" : "rgba(242,241,236,.16)";
        ctx.beginPath(); ctx.arc(x, y, u * (i < lit ? 0.34 : 0.26), 0, 7); ctx.fill();
      }
    };
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round((cv.width * ROWS) / COLS);
      draw();
    };
    // Ease the lit count toward the scroll target so dots switch on one by one even on a fast flick.
    const tick = () => {
      cur += (target - cur) * 0.12;
      if (Math.abs(target - cur) < 0.5) cur = target;
      draw();
      raf = cur === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const vh = innerHeight, r = el.getBoundingClientRect();
      // desktop: across the sticky range, eased so step 3 lights the last of them; phone: while the map itself crosses the screen
      let p: number;
      if (wide.matches) p = clamp((vh * 0.3 - r.top) / (r.height - vh)) ** 1.4;
      else { const m = cv.getBoundingClientRect(); p = clamp((vh - m.bottom) / (vh * 0.55)); }
      target = Math.round(p * N);
      if (!raf && target !== cur) raf = requestAnimationFrame(tick);
      let best = 0, bd = Infinity;
      steps.forEach((s, i) => { const b = s.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - vh / 2); if (d < bd) { bd = d; best = i; } });
      setActive(best);
    };

    const ro = new ResizeObserver(size);
    ro.observe(cv);
    if (reduce) return () => ro.disconnect();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
    return () => { ro.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const pad = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="about__story" ref={root}>
      <div className="about__stage">
        <div className="about__mapbox">
          <canvas ref={canvas} className="about__map" style={{ aspectRatio: `${COLS}/${ROWS}` }} role="img" aria-label="World map of dots lighting up as idle GPUs come online" />
        </div>
        <div className="about__big" aria-hidden="true">
          <span className="about__nums">
            {about.story.map((s, i) => <b key={s.title} className={i === active ? "on" : ""}>{pad(i)}</b>)}
          </span>
          <span className="mono">/ {pad(about.story.length - 1)}<br /><span className="accent">{about.story[active].title}</span></span>
        </div>
      </div>
      <ol className="about__steps">
        {about.story.map((s, i) => (
          <li className={`about__step${i === active ? " on" : ""}`} key={s.title}>
            <span className="about__n mono accent">{pad(i)}</span>
            <h4>{s.title}</h4><p>{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="currentColor" /></svg>;
const LI = "M4.98 3.5a2.49 2.49 0 1 1-4.98 0 2.49 2.49 0 0 1 4.98 0ZM.22 8h4.56v14H.22V8Zm7.5 0h4.37v1.92h.06c.61-1.15 2.1-2.36 4.33-2.36 4.63 0 5.48 3.05 5.48 7.01V22h-4.56v-6.6c0-1.57-.03-3.6-2.2-3.6-2.2 0-2.53 1.72-2.53 3.49V22H7.72V8Z";
const X = "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z";

// Card spotlight: follows the pointer via CSS variables (no re-render).
const spot = (e: React.PointerEvent<HTMLDivElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
};

export default function About() {
  return (
    <section className="sec" id="about">
      <div className="wrap">
        <Head h1 num={about.num} eyebrow={about.eyebrow} title={about.title} side={<><AirbnbLine /><br /><br />{about.side}</>} />
        <Eyebrow>{about.storyLabel}</Eyebrow>
        <Story />
        <div className="about__team">
          <div className="reveal"><Eyebrow>{about.teamLabel}</Eyebrow><p className="lead">{about.teamLead}</p></div>
          <div className="about__people">
            {about.team.map((m, i) => (
              <figure className="reveal" key={m.name} style={{ "--d": i } as React.CSSProperties}>
                <div className="about__card" onPointerMove={spot}>
                  <span className="about__glow" aria-hidden="true" />
                  <span className="about__idx mono" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  {/* Photo: set `photo` in content/about.ts to a path under /public; until then the initials stand in. */}
                  <div className="about__ring">
                    <div className="about__photo">
                      {m.photo ? <img src={m.photo} alt={m.name} /> : <span aria-hidden="true">{m.initials}</span>}
                    </div>
                  </div>
                  <div className="about__head">
                    <b className="about__name">{m.name}</b>
                    <span className="about__role">{m.role}</span>
                  </div>
                  <figcaption>
                    <ul className="about__tags" aria-label="Focus">{m.focus.split(" · ").map((t, k) => <li key={t} style={{ "--i": k } as React.CSSProperties}>{t}</li>)}</ul>
                    <p>{m.line}</p>
                    {m.quote && <blockquote>“{m.quote}”</blockquote>}
                    {(m.linkedin || m.x) && (
                      <div className="about__social">
                        {m.linkedin && <a href={m.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`}><Icon d={LI} /></a>}
                        {m.x && <a href={m.x} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on X`}><Icon d={X} /></a>}
                      </div>
                    )}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
