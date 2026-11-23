import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import DevConsole from "@/components/DevConsole";
import Head from "@/components/Head";
import { Arrow, Btn, Eyebrow, H2 } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { CONSOLE, alpha, hero, model, price, response, steps, tools, works } from "@/content/developers";

export const metadata: Metadata = pageMeta("Build with Tenvor | Tenvor", "/developers", hero.lead);

/** JSON colouring: keys orange, string values green, numbers blue. */
function json(line: string): ReactNode[] {
  return line.split(/("[^"]*"\s*:|"[^"]*"|\b\d+\b)/).map((p, i) =>
    i % 2 === 0 ? p : <span key={i} className={p.endsWith(":") ? "d-jk" : p.startsWith('"') ? "d-s" : "d-jn"}>{p}</span>);
}

export default function Page() {
  return (
    <>
      <main className="subpage dev">
        <section className="sec">
          <div className="wrap split chat">
            <div className="reveal">
              <Eyebrow num="01">API</Eyebrow>
              <H2 h1>{hero.title}</H2>
              <p className="lead">{hero.lead}</p>
              <div className="band__cta"><Btn href={CONSOLE} variant="accent">Sign up</Btn><Btn href="/docs/quickstart" variant="ghost">Read the quickstart</Btn></div>
              <p className="mono chat__start">{hero.start}</p>
            </div>
            <div>
              <DevConsole />
              <p className="mono dev__note"><span className="tag mono">Sample</span> Here <code>ticket</code> is the text of a support ticket.</p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap split split--wide">
            <div className="reveal">
              <Eyebrow num="02">A node on the network</Eyebrow>
              <h2 className="h2" id="dev-res-h">What comes back.</h2>
              <p className="lead">{response.node}</p>
              <p className="lead dev__every">{response.every}</p>
            </div>
            <div className="dev__json reveal">
              <p className="mono dev__st"><span>abridged</span><span className="dev__ok on"><i className="dot"></i>200 OK</span></p>
              <pre><code>{response.json.map((l, i) => <span key={i} className="dev__jl" style={{ "--i": i } as CSSProperties}>{json(l)}{"\n"}</span>)}</code></pre>
            </div>
          </div>
        </section>

        <section className="sec" id="price">
          <div className="wrap">
            <Head num="03" eyebrow="Pricing" title="Priced per token." side={`${price.text} ${price.plans}`} cta={{ href: "/pricing", label: "See pricing" }} />
            <div className="stats stats--3 reveal">
              {price.rows.map(([v, l], i) => <div key={l} style={{ "--i": i } as CSSProperties}><b className={i === 0 ? "accent" : undefined}>{v}</b><small className="mono">{l}</small><span className="bar"><span></span></span></div>)}
            </div>
          </div>
        </section>

        <section className="sec" id="works">
          <div className="wrap">
            <Head num="04" eyebrow="Compatibility" title="What works today." side={works.note} cta={{ href: "/docs/api/chat-completions", label: "Read the API reference" }} />
            <div className="grid3 grid3--2 dev__works">
              <div className="plan reveal"><h4>Works today</h4>
                <ul>{works.yes.map(w => <li key={w}><svg aria-hidden="true"><use href="#i-check" /></svg><span dangerouslySetInnerHTML={{ __html: w }} /></li>)}</ul></div>
              <div className="plan plan--muted reveal"><h4>Not yet</h4>
                <ul>{works.no.map(w => <li key={w}>{w}</li>)}</ul></div>
            </div>
          </div>
        </section>

        <section className="sec" id="tools">
          <div className="wrap split split--wide">
            <div className="reveal">
              <Eyebrow num="05">The model</Eyebrow>
              <H2>{model.title}</H2>
              <div className="d-tbl d-tbl--fit pmore"><table><tbody>{model.rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{k === "API id" ? <code>{v}</code> : v}</td></tr>)}</tbody></table></div>
              <a href="/models" className="link">See the models <Arrow className="accent" /></a>
            </div>
            <div className="reveal">
              <p className="mono dev__k">Works with</p>
              <div className="dev__tools">
                {tools.map(t => <a key={t.name} href={t.href} className="dev__tool"><b>{t.name}</b><span>{t.text}</span><Arrow className="accent" /></a>)}
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="alpha">
          <div className="wrap split split--wide">
            <div className="reveal"><Eyebrow num="06">The alpha</Eyebrow><H2>What to expect in the alpha.</H2></div>
            <ul className="dev__alpha reveal">{alpha.map(a => <li key={a} dangerouslySetInnerHTML={{ __html: a }} />)}</ul>
          </div>
        </section>

        <section className="sec band" id="start">
          <div className="wrap">
            <Head num="07" eyebrow="Get started" title="Three steps to your first request." side={hero.start} />
            <div className="grid3">
              {steps.map((s, i) => <div className="plan dev__step reveal" key={s.name} style={{ "--i": i } as CSSProperties}><span className="mono accent">{String(i + 1).padStart(2, "0")}</span><h4>{s.name}</h4><p dangerouslySetInnerHTML={{ __html: s.text }} /></div>)}
            </div>
            <div className="band__cta"><Btn href={CONSOLE} variant="accent">Sign up</Btn><Btn href="/docs/quickstart" variant="ghost">Read the quickstart</Btn></div>
          </div>
        </section>
      </main>
      <PageEffects intro={false} />
    </>
  );
}
