import type { Metadata } from "next";
import PageEffects from "@/components/PageEffects";
import LiveStatus from "@/components/LiveStatus";
import { Eyebrow, H2 } from "@/components/ui";
import { pageMeta } from "@/lib/seo";
import { getStatus } from "@/lib/uptime";
import "@/app/styles/status.css";

const intro = "Live status of Tenvor's services, checked continuously by our own monitors.";
export const metadata: Metadata = pageMeta("Status | Tenvor", "/status", intro);

export default async function Page() {
  return (
    <>
      <main className="subpage">
        <section className="sec">
          <div className="wrap">
            <div className="reveal">
              <Eyebrow>Status</Eyebrow>
              <H2 h1>Is Tenvor up?</H2>
              <p className="lead">{intro}</p>
            </div>
            <LiveStatus initial={await getStatus()} />
            <p className="pmore__note ls__note">These are measurements, not a service-level agreement. Qualifying outages under the <a href="/legal/service-credits" className="link">refund policy</a> are posted on this page.</p>
          </div>
        </section>
      </main>
      <PageEffects intro={false} />
    </>
  );
}
