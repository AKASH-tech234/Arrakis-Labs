// src/pages/Landing.jsx
import Header from "../components/layout/Header";
import Hero from "../components/landing/HERO3D";
import Features from "../components/ui/features-section";
import HowItWorks from "../components/landing/howitworks";
import CTA from "../components/landing/cta";
import Footer from "../components/landing/footer";

export default function Landing() {
  return (
    <main className="bg-black min-h-screen">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </main>
  );
}
