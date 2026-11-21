import { services } from "@/content/services";
import Head from "./Head";

export default function Services() {
  return (
    <section className="sec" id="services">
      <div className="wrap">
        <Head num="05" eyebrow="Products" title="One GPU network, six ways to use it."
          side="Start with a free API key and $0.25 of credit. No card needed, no subscription."
          cta={{ href: "https://tenvor.io/console", label: "Get an API key" }} />
        <div className="svc">
          {services.map((s, i) => (
            <div className="svc__row reveal" key={s.title}>
              <span className="mono accent">{String(i + 1).padStart(2, "0")}</span><span className="ico"><svg><use href={`#${s.icon}`} /></svg></span><h4>{s.title}</h4><div><p>{s.body}</p><small className="mono">{s.scope}</small></div><span className="mono price">{s.price}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
