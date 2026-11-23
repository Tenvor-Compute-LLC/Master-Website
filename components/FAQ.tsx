"use client";
import type { MouseEvent } from "react";
import Link from "next/link";
import { faqs } from "@/content/faq";
import { Arrow, Btn, Eyebrow, H2 } from "./ui";

// Animate height open/closed (live: no-bounce spring, 0.45s) while keeping native <details>
function toggle(e: MouseEvent<HTMLElement>) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  e.preventDefault();
  const sum = e.currentTarget, d = sum.parentElement as HTMLDetailsElement;
  const opening = !d.open || d.classList.contains("closing");
  const from = d.offsetHeight;
  d.getAnimations().forEach(a => a.cancel());
  d.classList.toggle("closing", !opening);
  d.open = true;
  const to = opening ? d.offsetHeight : sum.offsetHeight + d.offsetHeight - d.clientHeight;
  d.style.overflow = "hidden";
  d.animate({ height: [from + "px", to + "px"] }, { duration: 450, easing: "cubic-bezier(.25,1,.5,1)" }).onfinish = () => {
    if (!opening) { d.open = false; d.classList.remove("closing"); }
    d.style.overflow = "";
  };
}

export default function FAQ() {
  return (
    <section className="sec">
      <div className="wrap split split--faq">
        <div className="reveal">
          <Eyebrow num="03">FAQ</Eyebrow>
          <H2>Questions, answered.</H2>
          <p className="lead">Not answered here? The Trust page lists every known limit of the alpha, or write to support@tenvor.io.</p>
          <Btn href="mailto:support@tenvor.io" variant="ghost">Ask us anything</Btn>
        </div>
        <div className="faq reveal">
          {faqs.map(f => (
            <details key={f.q}><summary onClick={toggle}>{f.q}<svg><use href="#i-plus" /></svg></summary><p>{f.a}{f.href && <Link href={f.href} className="link" aria-label={`Read more: ${f.q}`}>Read more <Arrow className="accent" /></Link>}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}
