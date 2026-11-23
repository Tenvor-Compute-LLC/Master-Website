import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import DotArt from "@/components/DotArt";
import DocShell from "@/components/DocShell";
import { Arrow, Eyebrow, H2 } from "@/components/ui";
import { alpha, docsHead, glance, glanceNote, how, integrations, next, reference, reviewNote, start, toc, works, type DocCard, type Rich } from "@/content/docs";

export const metadata: Metadata = pageMeta("Docs | Tenvor", "/docs", docsHead.intro);

const ext = (h: string) => h.startsWith("http") ? { target: "_blank", rel: "noopener" } : {};
const A = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
  <a href={href} className={className} {...ext(href)}>{children}</a>;

function R({ r }: { r: Rich }) {
  return <>{r.map((p, i) => typeof p === "string" ? p : "code" in p ? <code key={i}>{p.code}</code> : <A key={i} href={p.href} className="docs__a">{p.text}</A>)}</>;
}

const Cards = ({ cards }: { cards: DocCard[] }) => (
  <ul className="docs__cards">{cards.map(c => <li key={c.href}><A href={c.href}><h3>{c.title}<Arrow /></h3><p>{c.body}</p></A></li>)}</ul>
);

const Sec = ({ id, num, title, children }: { id: string; num: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="docs__sec"><Eyebrow num={num}>Docs</Eyebrow><H2 wide>{title}</H2>{children}</section>
);

export default function Docs() {
  return (
    <DocShell head={docsHead} toc={toc} next={next} aside={<DotArt scene="docs" label="Code typed line by line, then the response comes back" />}>
      <Sec id="start" num="01" title="Start here">
        <p>{start.intro}</p>
        <ol className="docs__steps">{start.steps.map((s, i) => <li key={s.title}><span className="mono">{String(i + 1).padStart(2, "0")}</span><h3>{s.title}</h3><p><R r={s.body} /></p></li>)}</ol>
      </Sec>
      <Sec id="how" num="02" title="How a request runs">{how.map(p => <p key={p}>{p}</p>)}</Sec>
      <Sec id="at-a-glance" num="03" title="The API at a glance">
        <dl className="docs__dl">{glance.map(g => <div key={g.k}><dt>{g.k}</dt><dd><R r={g.v} /></dd></div>)}</dl>
        <p><R r={glanceNote} /></p>
      </Sec>
      <Sec id="works" num="04" title="What works today">
        <div className="docs__works">
          <div><h3>Works today</h3><ul>{works.yes.map((r, i) => <li key={i}><R r={r} /></li>)}</ul></div>
          <div className="docs__no"><h3>Not yet</h3><ul>{works.no.map(t => <li key={t}>{t}</li>)}</ul></div>
        </div>
        <p className="docs__note">{works.note}</p>
        <p><A href={works.more.href} className="docs__a">{works.more.text}</A></p>
      </Sec>
      <Sec id="integrations" num="05" title="Connect a tool"><p>{integrations.intro}</p><Cards cards={integrations.cards} /></Sec>
      <Sec id="reference" num="06" title="Reference"><Cards cards={reference} /></Sec>
      <Sec id="alpha" num="07" title="The alpha, in short">
        <div className="docs__alpha">
          <ul>{alpha.points.map(p => <li key={p}>{p}</li>)}</ul>
          <p className="docs__links">{alpha.links.map((l, i) => <span key={l.href}>{i > 0 && " · "}<A href={l.href} className="docs__a">{l.label}</A></span>)}</p>
        </div>
      </Sec>
      <p className="docs__review"><R r={reviewNote} /></p>
    </DocShell>
  );
}
