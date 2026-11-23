import type { CSSProperties } from "react";
import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import Head from "@/components/Head";
import MoeGrid from "@/components/MoeGrid";
import { Btn, Eyebrow, H2 } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { head, live, next, use } from "@/content/models";

export const metadata: Metadata = pageMeta("Models | Tenvor", "/models", head.intro);

/** Strings green, comments grey: enough colour for a six-line sample. */
const py = (l: string) => l.startsWith("#") ? <span className="d-c">{l}</span>
  : l.split(/("[^"]*")/).map((p, i) => i % 2 ? <span key={i} className="d-s">{p}</span> : p);

export default function Page() {
  return (
    <>
      <main className="subpage mdl">
        <section className="sec">
          <div className="wrap">
            <Head num="01" h1 eyebrow={head.kicker} title={head.title} side={head.intro} cta={{ href: "https://tenvor.io/console", label: "Get API key" }} />
            <article className="mdl__live reveal" id={`m-${live.id}`}>
              <div className="mdl__main">
                <p className="mono mdl__state"><i className="dot"></i>Live now</p>
                <h2 className="mdl__name">{live.name}</h2>
                <code className="mdl__id">{live.id}</code>
                <p className="mdl__txt">{live.text}</p>
                <ul className="tags" aria-label="Features">{live.tags.map(t => <li key={t}><span className="mono">{t}</span></li>)}</ul>
                <MoeGrid />
              </div>
              <div className="mdl__side">
                <div className="mdl__prices">{live.prices.map(([v, l], i) => <div key={l} style={{ "--i": i } as CSSProperties}><small className="mono">{l}</small><b className={i === 0 ? "accent" : undefined}>{v}</b></div>)}</div>
                <p className="mono mdl__per">{live.per}</p>
                <dl className="mdl__rows">{live.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              </div>
            </article>
          </div>
        </section>

        <section className="sec" aria-label="Coming next">
          <div className="wrap">
            <Head num="02" eyebrow="Next" title={next.name} side={next.text} />
            <div className="mdl__next reveal">
              <p className="mono mdl__soon"><span className="tag mono">{next.status}</span></p>
              <div className="stats stats--4">{next.specs.map(([k, v, s], i) => <div key={k} style={{ "--i": i } as CSSProperties}><small className="mono">{k}</small><b>{v}</b><small className="mono">{s}</small></div>)}</div>
              <p className="pmore__note">{next.note}</p>
            </div>
          </div>
        </section>

        <section className="sec band">
          <div className="wrap split chat">
            <div className="reveal">
              <Eyebrow num="03">Use a model</Eyebrow>
              <H2>{use.title}</H2>
              <p className="lead">{use.text}</p>
              <div className="band__cta"><Btn href="https://tenvor.io/console" variant="accent">Get API key</Btn><Btn href="/docs/models-and-limits" variant="ghost">Models and limits</Btn></div>
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
