import { Btn, Eyebrow, H2 } from "./ui";

type Cta = { href: string; label: string };

/** Closing band for a page: eyebrow + headline on the left, one fact line and two buttons on the right. */
export default function CtaBand({ num, eyebrow, title, text, primary, secondary }: {
  num: string; eyebrow: string; title: string; text: string; primary: Cta; secondary: Cta;
}) {
  return (
    <section className="sec band">
      <div className="wrap band__in reveal">
        <div><Eyebrow num={num}>{eyebrow}</Eyebrow><H2>{title}</H2></div>
        <div className="head__side">
          <p>{text}</p>
          <div className="band__cta"><Btn href={primary.href} variant="accent">{primary.label}</Btn><Btn href={secondary.href} variant="ghost">{secondary.label}</Btn></div>
        </div>
      </div>
    </section>
  );
}
