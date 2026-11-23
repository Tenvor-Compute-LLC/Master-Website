import type { CSSProperties } from "react";
import type { SitePage } from "@/content/pages/types";

const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** The document's parts with their length in characters: sections (h2) where the page has them, otherwise its list items. */
export function docRows(page: SitePage) {
  if (page.toc.length) return page.toc.map((t, i) => {
    const id = t.href.slice(1);
    const s = page.html.split(`<h2 id="${id}">`)[1] ?? "";
    const next = page.toc[i + 1] ? s.split(`<h2 id="${page.toc[i + 1].href.slice(1)}">`)[0] : s;
    return { label: t.label, n: text(next).length };
  });
  return [...page.html.matchAll(/<li>(.*?)<\/li>/g)].map(m => ({ label: text(m[1]), n: text(m[1]).length }));
}

/** Beside the heading: a map of the document, one bar per part, as long as that part. Bars draw in, then fill as you read. */
export default function LegalDoc({ page, rows = docRows(page), unit = page.toc.length ? "sections" : "points", note = "Bar length is the length of each part. Bars fill as you read." }: { page: SitePage; rows?: { label: string; n: number }[]; unit?: string; note?: string }) {
  const eff = page.html.match(/(Effective)(?: date:<\/strong>)? ([^<.]+)/) ?? page.html.match(/(Date):<\/strong> ([^<]+)/);
  const upd = page.html.match(/Last updated:<\/strong> ([^<]+)/)?.[1];
  const max = Math.max(...rows.map(r => r.n), 1);
  const dense = rows.length > 12;
  return (
    <div className={`agent lgd reveal${dense ? " lgd--dense" : ""}`} aria-hidden="true">
      <div className="agent__top"><span className="agent__ico"><img src="/img/logo-t.svg" alt="" /></span><b>Document map</b><span className="mono live">{rows.length} {unit}</span></div>
      <p className="mono lgd__meta">{eff && <span>{eff[1]} <b>{eff[2]}</b></span>}{upd && <span>Updated <b>{upd}</b></span>}</p>
      <ol className="lgd__rows">
        {rows.map((r, i) => (
          <li key={i} className="lgd__row" style={{ "--i": i, "--w": (0.18 + 0.82 * r.n / max).toFixed(3) } as CSSProperties}>
            {!dense && <span className="mono lgd__n">{String(i + 1).padStart(2, "0")}</span>}
            {!dense && <span className="lgd__l">{r.label.replace(/^\d+\.\s*/, "")}</span>}
            <span className="lgd__bar"><i></i></span>
          </li>
        ))}
      </ol>
      <p className="mono chat__note">{note}</p>
    </div>
  );
}
