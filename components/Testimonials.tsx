import Link from "next/link";
import { testimonials } from "@/content/testimonials";
import Head from "./Head";
import { Arrow } from "./ui";

export default function Testimonials() {
  return (
    <section className="sec">
      <div className="wrap">
        <Head num="08" eyebrow="Why teams try it" title="What you get on day one." side="Facts from our pricing, trust and docs pages. No made-up customers." />
        <div className="grid3">
          {testimonials.map(t => (
            <article className="quote reveal" key={t.tag}>
              <span className="tag mono">{t.tag}</span><p>{t.text}</p>
              <Link href={t.href} className="link" aria-label={`Read more on the ${t.dest}`}>{t.label} <Arrow className="accent" /></Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
