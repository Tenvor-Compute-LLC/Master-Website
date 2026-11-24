import HeroFlow from "./HeroFlow";
import LogoMarquee from "./LogoMarquee";
import { Btn, Words } from "./ui";

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <p className="pill mono reveal"><i className="dot"></i><span>The open-model network</span> <span className="pill__sep">|</span> <span className="pill__hi"><i className="dot"></i>API Operational</span></p>
        <h1 className="display"><Words><em>Open-model cloud,</em> powered by the world’s idle GPUs.</Words></h1>
        <div className="hero__row reveal">
          <p className="lead">One orchestration layer for open models, running across distributed GPUs in sealed containers. Start free with no card.</p>
          <div className="btns">
            <Btn href="https://app.tenvor.io" variant="accent">Get an API key</Btn>
            <Btn href="/docs/quickstart" variant="ghost">Read the quickstart</Btn>
          </div>
        </div>
        <HeroFlow />
      </div>
      <LogoMarquee />
    </section>
  );
}
