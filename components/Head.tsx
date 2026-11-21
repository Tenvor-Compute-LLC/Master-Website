import { Btn, Eyebrow, H2 } from "./ui";

/** Section header: eyebrow + h2 on the left, a blurb and an optional button on the right. */
export default function Head({ num, eyebrow, title, wide, side, cta }: {
  num: string; eyebrow: string; title: string; wide?: boolean; side: string; cta?: { href: string; label: string };
}) {
  return (
    <div className="head reveal">
      <div><Eyebrow num={num}>{eyebrow}</Eyebrow><H2 wide={wide}>{title}</H2></div>
      <div className="head__side"><p>{side}</p>{cta && <Btn href={cta.href} variant="ghost">{cta.label}</Btn>}</div>
    </div>
  );
}
