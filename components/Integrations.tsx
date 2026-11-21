import { integrations } from "@/content/integrations";
import { Eyebrow, H2 } from "./ui";

export default function Integrations() {
  return (
    <section className="sec">
      <div className="wrap split split--wide">
        <div className="reveal">
          <Eyebrow num="04">Integrations</Eyebrow>
          <H2>Works with the tools you already pay for.</H2>
          <p className="lead">We connect your CRM, inbox, help desk, ERP and data warehouse. No rip-and-replace, and no new logins for your team.</p>
          <p className="mono small">50+ native integrations · Custom APIs · Webhooks</p>
        </div>
        <div className="tiles mono reveal">
          {integrations.map(t => <div key={t.name}><img src={t.logo} alt="" />{t.name}</div>)}
        </div>
      </div>
    </section>
  );
}
