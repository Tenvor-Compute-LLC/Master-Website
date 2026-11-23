import Link from "next/link";
import type { ReactNode } from "react";
import "@/app/styles/anim-docs.css";
import DocCopy from "@/components/DocCopy";
import DocGuides from "@/components/DocGuides";
import DocType from "@/components/DocType";
import PageEffects from "@/components/PageEffects";
import { Arrow, Btn, Eyebrow } from "@/components/ui";
import type { DocPage, NavLink } from "@/content/docs/types";

function Side({ toc }: { toc: NavLink[] }) {
  return (
    <>
      <p className="mono docs__k">On this page</p>
      <ul>{toc.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>
      <p className="mono docs__k">Documentation</p>
      <DocGuides />
    </>
  );
}

const PagerLink = ({ l, dir }: { l: NavLink; dir: "Previous" | "Next" }) =>
  <Link href={l.href} className={`docs__next docs__next--${dir === "Next" ? "fwd" : "back"}`}><span className="mono">{dir}</span><span>{l.label}</span><Arrow /></Link>;

/** Shared docs frame: page head, the sidebar (this page's contents + the guide list), the body and Previous/Next. */
export default function DocShell({ head, toc, prev, next, aside, children }: {
  head: Pick<DocPage, "kicker" | "title" | "actions"> & { intro: ReactNode };
  toc: NavLink[]; prev?: NavLink; next?: NavLink; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <main className="docs">
      <div className="wrap">
        <header className={aside ? "docs__head split chat" : "docs__head"}>
          <div>
            <Eyebrow>{head.kicker}</Eyebrow>
            <h1 className="display">{head.title}</h1>
            <p className="lead">{head.intro}</p>
            {head.actions.length > 0 && <div className="btns">{head.actions.map((a, i) => <Btn key={a.href} href={a.href} variant={i ? "ghost" : "accent"}>{a.label}</Btn>)}</div>}
          </div>
          {aside}
        </header>
        <details className="docs__menu"><summary className="mono">Guides and contents</summary><nav><Side toc={toc} /></nav></details>
        <div className="docs__grid">
          <nav className="docs__side" aria-label="Documentation"><Side toc={toc} /></nav>
          <div className="docs__body">
            {children}
            <nav className="docs__pager" aria-label="Previous and next guide">
              {prev && <PagerLink l={prev} dir="Previous" />}
              {next && <PagerLink l={next} dir="Next" />}
            </nav>
          </div>
        </div>
      </div>
      <DocCopy />
      <DocType />
      <PageEffects intro={false} />
    </main>
  );
}

/** A docs subpage: its markup rendered inside the shell. */
export function DocArticle({ page, aside }: { page: DocPage; aside?: ReactNode }) {
  return (
    <DocShell head={{ ...page, intro: <span dangerouslySetInnerHTML={{ __html: page.intro }} /> }} toc={page.toc} prev={page.prev} next={page.next} aside={aside}>
      <div className="docs__prose" dangerouslySetInnerHTML={{ __html: page.html }} />
    </DocShell>
  );
}
