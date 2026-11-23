import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import CtaBand from "@/components/CtaBand";
import Head from "@/components/Head";
import { Arrow, Btn, Eyebrow, H2 } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { CONSOLE, close, cost, hero, limits, model, modes, sample } from "@/content/chat";

export const metadata: Metadata = pageMeta("Chat & Work | Tenvor", "/chat", "Ask a question, or hand over a file. Chat answers and can search the web. Work can also run code on your files and hand back the results.");

export default function Page() {
  return (
    <>
      <main className="subpage">
        <section className="sec">
          <div className="wrap split chat">
            <div className="reveal">
              <Eyebrow num="01">Chat &amp; Work</Eyebrow>
              <H2 h1>{hero.title}</H2>
              <p className="lead">Ask a question, or hand over a file. <a href="#mode-chat">Chat</a> answers and can search the web. <a href="#mode-work">Work</a> can also run code on your files and hand back the results. You pay for what you use: a short message is about $0.0002.</p>
              <div className="band__cta"><Btn href={CONSOLE} variant="accent">Sign up</Btn><Btn href={CONSOLE} variant="ghost">Sign in</Btn></div>
              <p className="mono chat__start">{hero.start}</p>
            </div>
            <figure className="agent chat__win reveal">
              <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Chat &amp; Work</b><span className="mono live"><span className="tag mono">Sample</span></span></div>
              <p className="chat__me">{sample.ask}</p>
              <div className="chat__bot"><p className="mono chat__who">{sample.model}</p><p>{sample.reply}</p>
                <dl className="mono chat__rcpt">{sample.receipt.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              </div>
              <div className="chat__box" aria-hidden="true"><span>Message</span><span className="mono chat__sw"><i></i>Work</span></div>
              <figcaption className="mono chat__note">{sample.note}</figcaption>
            </figure>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <Head num="02" eyebrow="Modes" title="Two modes." side={modes.side} />
            <div className="grid3 grid3--2">
              {modes.cards.map(m => (
                <div className="plan reveal" id={m.id} key={m.id}>
                  <h4>{m.name} <span className="tag mono">{m.tag}</span></h4>
                  <p className="sub">{m.lead}</p>
                  <ul>{m.points.map(p => <li key={p}><svg aria-hidden="true"><use href="#i-check" /></svg>{p}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap split split--wide">
            <div className="reveal">
              <Eyebrow num="03">Pricing</Eyebrow>
              <H2>What it costs.</H2>
              <p className="lead">{cost.text}</p>
              <a href="/pricing" className="link">See pricing <Arrow className="accent" /></a>
            </div>
            <div className="d-tbl d-tbl--fit pmore reveal"><table><tbody>
              {cost.rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}
            </tbody></table></div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <Head num="04" eyebrow="Each task" title={limits.title} side={limits.text} />
            <div className="stats stats--3 reveal">
              {limits.items.map(([n, l]) => <div key={l}><small className="mono">Up to</small><b className={n === "10" ? "accent" : undefined}>{n}</b><small className="mono">{l}</small></div>)}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap split split--wide">
            <div className="reveal"><Eyebrow num="05">The model</Eyebrow><H2>{model.title}</H2></div>
            <div className="reveal chat__txt">
              <p className="lead">{model.text}</p>
              <p className="lead">{model.data}</p>
              <a href="/trust#chat-work" className="link">How your data is handled <Arrow className="accent" /></a>
            </div>
          </div>
        </section>

        <CtaBand num="06" eyebrow="Get started" title={close.title} text={close.text}
          primary={{ href: CONSOLE, label: "Sign up" }} secondary={{ href: CONSOLE, label: "Sign in" }} />
      </main>
      <PageEffects intro={false} />
    </>
  );
}
