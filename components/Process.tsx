import { steps } from "@/content/process";
import Link from "next/link";
import Head from "./Head";
import { Arrow } from "./ui";

export default function Process() {
  return (
    <section className="sec">
      <div className="wrap">
        <Head num="03" eyebrow="How it works" title="From sign-up to first reply in four steps." wide
          side="Keep the OpenAI SDK you already use. Change one URL, and every reply comes back with an itemised receipt." />
        <ol className="steps reveal">
          {steps.map((s, i) => (
            <li key={s.title} className={i === 0 ? "is-on" : undefined}>
              <p className="mono"><span className="accent">{String(i + 1).padStart(2, "0")}</span><span>{s.when}</span></p><h4>{s.title}</h4><p>{s.body}</p>
            </li>
          ))}
        </ol>
        <Link href="/docs/quickstart" className="link steps__more">Read the quickstart <Arrow className="accent" /></Link>
      </div>
    </section>
  );
}
