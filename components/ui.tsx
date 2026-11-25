import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";

/** Arrow icon from the sprite. */
export function Arrow({ className }: { className?: string }) {
  return <svg className={className}><use href="#i-arrow" /></svg>;
}

/** Button link: the label is pre-wrapped in .btn__t so it can roll up on hover, as script.js did at runtime. */
export function Btn({ href, variant, block, children }: { href: string; variant: "accent" | "ghost"; block?: boolean; children: string }) {
  return (
    <a href={href} className={`btn btn--${variant}${block ? " btn--block" : ""}`} {...(href.startsWith("http") && { target: "_blank", rel: "noopener" })}>
      <span className="btn__t"><span>{children}</span></span>{" "}
      <span className="btn__ico"><Arrow /></span>
    </a>
  );
}

export function Eyebrow({ num, children }: { num?: string; children: string }) {
  return <p className="eyebrow mono"><i></i>{num && <><span>[{num}]</span>{" "}</>}{children}</p>;
}

/**
 * Splits heading text into .w word spans with a --d delay, 0.05s apart from 0.05s (as live).
 * Like script.js, an inline element (e.g. <em>) counts as one empty token on each side.
 */
export function Words({ children }: { children: ReactNode }) {
  let i = 1;
  const walk = (node: ReactNode): ReactNode =>
    Children.map(node, (n) => {
      if (typeof n === "string")
        return n.split(/(\s+)/).filter(Boolean).map((t, k) =>
          /^\s+$/.test(t) ? t : (
            <span key={k} className="w" style={{ "--d": `${(i++ * 0.05).toFixed(2)}s` } as CSSProperties}>{t}</span>
          ));
      if (isValidElement(n)) {
        const el = n as ReactElement<{ children?: ReactNode }>;
        i++;
        const kids = walk(el.props.children);
        i++;
        return cloneElement(el, undefined, kids);
      }
      return n;
    });
  return <>{walk(children)}</>;
}

/** Section h2 with the word-by-word reveal. */
export function H2({ wide, h1, children }: { wide?: boolean; h1?: boolean; children: string }) {
  const Tag = h1 ? "h1" : "h2";
  return <Tag className={`h2${wide ? " h2--wide" : ""}`}><Words>{children}</Words></Tag>;
}

/** The one-line pitch used on Home and About. */
export const AirbnbLine = () => <>Think <span className="accent">Airbnb for idle GPUs</span>: owners list spare capacity, developers get one API, and Tenvor runs everything in between.</>;
