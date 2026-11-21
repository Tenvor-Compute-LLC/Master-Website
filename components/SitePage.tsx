import Link from "next/link";
import PageEffects from "@/components/PageEffects";
import { Eyebrow } from "@/components/ui";
import { legalNav, type SitePage } from "@/content/pages/types";

function LegalSide({ page, toc = true }: { page: SitePage; toc?: boolean }) {
  return (
    <>
      {toc && page.toc.length > 0 && <><p className="mono docs__k">On this page</p><ul>{page.toc.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul></>}
      <p className="mono docs__k">Legal / public alpha</p>
      <ul>{legalNav.map(l => <li key={l.href}><Link href={l.href} aria-current={l.href === page.path ? "page" : undefined}>{l.label}</Link></li>)}</ul>
    </>
  );
}

/** A content page in the docs frame: head, then the source markup; legal documents get the policy library sidebar. */
export default function SitePageView({ page }: { page: SitePage }) {
  const legal = page.path.startsWith("/legal/");
  const body = <div className="docs__prose site__prose" dangerouslySetInnerHTML={{ __html: page.html }} />;
  return (
    <main className="docs site">
      <div className="wrap">
        <header className="docs__head">
          {page.kicker && <Eyebrow>{page.kicker}</Eyebrow>}
          <h1 className="display">{page.title}</h1>
          {page.intro && <p className="lead" dangerouslySetInnerHTML={{ __html: page.intro }} />}
        </header>
        {legal ? <>
          <details className="docs__menu"><summary className="mono">Policy library</summary><nav><LegalSide page={page} toc={false} /></nav></details>
          {page.toc.length > 0 && <nav className="site__toc" aria-label="On this page"><p className="mono docs__k">On this page</p><ol>{page.toc.map(l => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ol></nav>}
          <div className="docs__grid">
            <nav className="docs__side" aria-label="Policy library"><LegalSide page={page} /></nav>
            <div className="docs__body">{body}</div>
          </div>
        </> : <div className="docs__body site__body">{body}</div>}
      </div>
      <PageEffects intro={false} />
    </main>
  );
}
