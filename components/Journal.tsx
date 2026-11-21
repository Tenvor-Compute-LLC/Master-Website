import { posts } from "@/content/journal";
import Head from "./Head";
import CardArt from "./CardArt";

export default function Journal() {
  return (
    <section className="sec" id="journal">
      <div className="wrap">
        <Head num="11" eyebrow="Guides" title="From a new key to your first reply."
          side="Step-by-step guides from the Tenvor docs. Start free, no card needed."
          cta={{ href: "/docs", label: "Read the docs" }} />
        <div className="grid3">
          {posts.map(p => (
            <a href={p.href} className="post reveal" key={p.title}>
              <div className="post__frame"><CardArt art={p.art === "terminal" ? "setup" : p.art} alt={p.alt} /></div><p className="mono meta"><span className="accent">{p.kind}</span> / {p.meta}</p><h4>{p.title}</h4>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
