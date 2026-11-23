import { cases } from "@/content/work";
import Head from "./Head";
import CardArt from "./CardArt";
import UseCaseMap from "./UseCaseMap";
import { Arrow } from "./ui";

export default function Projects() {
  return (
    <section className="sec" id="use-cases">
      <div className="wrap">
        <Head num="03" eyebrow="Use cases" title="Build on open models, or serve them."
          side="One OpenAI-compatible API, served by GPUs on the Tenvor network. Each request runs sealed. Start free, no card."
          cta={{ href: "/models", label: "See the models" }} />
        <div className="cases">
          {cases.map(c => (
            <article className="case reveal" key={c.title}>
              <div className="case__img">{c.art === "terminal" ? <UseCaseMap /> : <CardArt art={c.art} alt={c.alt} />}<span className="chip mono"><i className="dot"></i>{c.tool}</span></div>
              <div className="case__body">
                <p className="mono meta"><span className="accent">{c.kind}</span> / {c.status}</p>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <div className="kpis">{c.kpis.map(k => <div key={k.label}><b>{k.value}</b><small className="mono">{k.label}</small></div>)}</div>
                <a href={c.href} className="link" {...(c.href.startsWith("http") && { target: "_blank", rel: "noopener" })}>{c.link} <Arrow className="accent" /></a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
