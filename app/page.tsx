import About from "@/components/About";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Integrations from "@/components/Integrations";
import Journal from "@/components/Journal";
import Nav from "@/components/Nav";
import PageEffects from "@/components/PageEffects";
import Pricing from "@/components/Pricing";
import Problem from "@/components/Problem";
import Process from "@/components/Process";
import Projects from "@/components/Projects";
import Services from "@/components/Services";
import Sprite from "@/components/Sprite";
import Stats from "@/components/Stats";
import Testimonials from "@/components/Testimonials";

export default function Home() {
  return (
    <>
      <Sprite />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Projects />
        <Process />
        <Integrations />
        <Services />
        <Stats />
        <About />
        <Testimonials />
        <Pricing />
        <FAQ />
        <Journal />
      </main>
      <Footer />
      <PageEffects />
    </>
  );
}
