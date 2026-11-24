import type { CSSProperties } from "react";
import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import Head from "@/components/Head";
import ModelRoster from "@/components/ModelRoster";
import Globe from "@/components/Globe";
import { Arrow, Btn, Eyebrow, H2 } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { abliterated, head, live, next, roadmap, use } from "@/content/models";

export const metadata: Metadata = pageMeta("Models | Tenvor", "/models", head.intro);

const CONSOLE = "https://app.tenvor.io";
/** Strings green, comments grey: enough colour for a six-line sample. */
const py = (l: string) => l.startsWith("#") ? <span className="d-c">{l}</span>
  : l.split(/("[^"]*")/).map((p, i) => i % 2 ? <span key={i} className="d-s">{p}</span> : p);

export default function Page() {
  return (
    <>
      <main className="subpage mdl">
        <section className="sec">
          <div className="wrap split chat">
            <div className="reveal">
              <Eyebrow num="01">{head.kicker}</Eyebrow>
              <H2 h1>{head.title}</H2>
              <p className="lead">{head.intro}</p>
              <div className="band__cta"><Btn href={CONSOLE} variant="accent">Get API key</Btn><Btn href="/docs/models-and-limits" variant="ghost">Models and limits</Btn></div>
            </div>
            <ModelRoster />
          </div>
        </section>

        <section className="sec" id={`m-${live.id}`}>
          <div className="wrap">
            <Head num="02" eyebrow="Live now" title={`${live.name}.`} side={live.text} />
            <div className="stats stats--3 reveal">
              {live.prices.map(([v, l], i) => <div key={l} style={{ "--i": i } as CSSProperties}><small className="mono">{l}</small><b className={i === 0 ? "accent" : undefined}>{v}</b><small className="mono">per million tokens</small><span className="bar"><span></span></span></div>)}
            </div>
            <p className="pmore__note mono mdl__per">{live.per}</p>
            <div className="grid3 grid3--2 mdl__pair">
              <div className="plan reveal">
                <h4>Model <code className="mdl__id">{live.id}</code></h4>
                <ul className="tags">{live.tags.map(t => <li key={t}><span className="mono">{t}</span></li>)}</ul>
                <dl className="mdl__rows">{live.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              </div>
              <div className="plan reveal"><h4>Served by idle GPUs</h4><Globe /></div>
            </div>
          </div>
        </section>

        <section className="sec" aria-label="Coming next">
          <div className="wrap">
            <Head num="03" eyebrow={`Next · ${next.status}`} title={`${next.name}.`} side={next.text} />
            <div className="stats stats--4 reveal">{next.specs.map(([k, v, s], i) => <div key={k} style={{ "--i": i } as CSSProperties}><small className="mono">{k}</small><b>{v}</b><small className="mono">{s}</small><span className="bar"><span></span></span></div>)}</div>
            <p className="pmore__note">{next.note}</p>
          </div>
        </section>

        <section className="sec" id="roadmap">
          <div className="wrap">
            <Head num="04" eyebrow={roadmap.label} title={roadmap.title} side={roadmap.side} />
            {/* bar length is total parameters against 1T; the solid part is parameters active per token */}
            <div className="d-tbl d-tbl--fit rm reveal">
              <table>
                <thead><tr><th scope="col">Model</th><th scope="col"><span className="s-vh">Size to scale</span></th><th scope="col" className="rm__n">Total</th><th scope="col" className="rm__n">Active</th></tr></thead>
                <tbody>
                  {[{ name: live.name, maker: "Live today", total: 35, active: 3, live: true }, ...roadmap.models.map(m => ({ ...m, live: false }))].map((m, i) => (
                    <tr key={m.name} className={m.live ? "rm__live" : undefined}>
                      <th scope="row"><b>{m.name}</b><small>{m.live ? <><i className="dot"></i> {m.maker}</> : m.maker}</small></th>
                      <td className="rm__bar" aria-hidden="true"><span style={{ "--t": m.total / 1000, "--a": m.active / m.total, "--i": i } as CSSProperties}><i></i></span></td>
                      <td className="rm__n">{m.total >= 1000 ? "1T" : `${m.total}B`}</td>
                      <td className="rm__n">{m.active}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mono rm__key">Bars to scale · solid part is active for each token</p>
            <div className="plan rm__soon reveal">
              <span className="tag mono">{abliterated.label}</span>
              <div><h4>{abliterated.title}</h4><p>{abliterated.text}</p></div>
              <a href="/legal/acceptable-use" className="link">Acceptable use <Arrow className="accent" /></a>
            </div>
          </div>
        </section>

        <section className="sec band">
          <div className="wrap split chat">
            <div className="reveal">
              <Eyebrow num="05">Use a model</Eyebrow>
              <H2>{use.title}</H2>
              <p className="lead">{use.text}</p>
              <div className="band__cta"><Btn href={CONSOLE} variant="accent">Get API key</Btn><Btn href="/docs/models-and-limits" variant="ghost">Models and limits</Btn></div>
            </div>
            <div className="agent dev__con dev__json reveal">
              <div className="dev__tabs mono"><span className="dev__fn">{use.file}</span></div>
              <pre className="dev__code"><code>{use.code.map((l, i) => <span key={i} className="dev__jl" style={{ "--i": i } as CSSProperties}>{py(l)}{"\n"}</span>)}</code></pre>
            </div>
          </div>
        </section>
      </main>
      <PageEffects intro={false} />
    </>
  );
}
