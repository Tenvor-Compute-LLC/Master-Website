import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import PageEffects from "@/components/PageEffects";
import { Eyebrow } from "@/components/ui";
import { pageMeta } from "@/lib/seo";

const intro = "Questions about your account, a payment, a plan, running a node or working with us. Send us a message and we will reply by email.";

export const metadata: Metadata = pageMeta("Contact | Tenvor", "/contact", intro);

export default function Page() {
  return (
    <main className="docs site">
      <div className="wrap">
        <header className="docs__head">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="display">How can we help?</h1>
          <p className="lead">{intro}</p>
        </header>
        <div className="docs__body site__body"><ContactForm /></div>
      </div>
      <PageEffects intro={false} />
    </main>
  );
}
