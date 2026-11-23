import type React from "react";
import { integrations } from "@/content/integrations";
import { Eyebrow, H2 } from "./ui";

export default function Integrations() {
  return (
    <section className="sec">
      <div className="wrap split split--wide">
        <div className="reveal">
          <Eyebrow num="04">Integrations</Eyebrow>
          <H2>Works with the tools you already use.</H2>
          <p className="lead">One OpenAI-compatible API. Point your SDK, agent framework, editor or chat app at Tenvor by changing the base URL and key. No code rewrite.</p>
          <p className="mono small">OpenAI-compatible · Streaming · Function tools</p>
        </div>
        <div className="tiles mono reveal">
          {integrations.map(t => <div key={t.name} style={{ "--brand": t.brand } as React.CSSProperties}><span className="tiles__ico"><img src={t.logo} alt="" /></span>{t.name}</div>)}
        </div>
      </div>
    </section>
  );
}
