import Link from "next/link";
import { Btn, H2 } from "./ui";

export default function Footer() {
  return (
    <footer className="foot" id="contact">
      <div className="wrap">
        <div className="foot__top">
          <div className="reveal">
            <H2>Run open models on idle GPUs.</H2>
            <p className="lead">Get an API key and $0.25 of free credit. No card needed. Questions? Write to support@tenvor.io.</p>
            <div className="foot__pay">
              <div className="foot__cards" role="group" aria-label="We accept">
                <img src="/img/pay/visa.svg" alt="Visa" width={44} height={28} />
                <img src="/img/pay/mastercard.svg" alt="Mastercard" width={44} height={28} />
                <img src="/img/pay/discover.svg" alt="Discover" width={44} height={28} />
                <img src="/img/pay/amex.svg" alt="American Express" width={44} height={28} />
              </div>
              <p>Card payments are processed by Authorize.net. Tenvor never sees or stores your card number.</p>
            </div>
          </div>
          <div className="foot__cols reveal">
            <div><p className="mono">Sitemap</p><Link href="/">Home</Link><Link href="/#services">Products</Link><Link href="/#pricing">Pricing</Link><Link href="/docs">Docs</Link><Link href="/models">Models</Link><Link href="/#about">About</Link><Link href="/#journal">Guides</Link></div>
            <div><p className="mono">Company</p><a href="mailto:support@tenvor.io">support@tenvor.io</a><Link href="/operators">Run a node</Link><Link href="/trust">Trust &amp; security</Link><Link href="/status">Status</Link><Link href="/contact">Contact</Link></div>
            <div><p className="mono">Legal</p><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/acceptable-use">Acceptable use</Link><Link href="/legal/cookies">Cookies</Link></div>
            <div><p className="mono">Social</p><a href="https://www.linkedin.com/company/tenvor-compute/" target="_blank" rel="noopener noreferrer">LinkedIn</a></div>
            <div className="foot__cta"><Btn href="https://tenvor.io/console" variant="accent">Get an API key</Btn></div>
          </div>
        </div>
        <p className="wordmark" aria-hidden="true">Tenvor</p>
        <div className="foot__bar mono"><span>© 2026 Tenvor Compute LLC. All rights reserved.</span><span>Built by a distributed team, running on distributed GPUs.</span></div>
      </div>
    </footer>
  );
}
