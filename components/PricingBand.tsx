import { Btn, Eyebrow, H2 } from "./ui";

/** Home page hand-off to /pricing: one line of facts and two buttons. */
export default function PricingBand() {
  return (
    <section className="sec band">
      <div className="wrap band__in reveal">
        <div><Eyebrow num="05">Pricing</Eyebrow><H2>Pay monthly or per token.</H2></div>
        <div className="head__side">
          <p>New accounts start with $0.25 of free credit; failed requests cost $0.</p>
          <div className="band__cta"><Btn href="/pricing" variant="accent">See pricing</Btn><Btn href="/products" variant="ghost">Explore products</Btn></div>
        </div>
      </div>
    </section>
  );
}
