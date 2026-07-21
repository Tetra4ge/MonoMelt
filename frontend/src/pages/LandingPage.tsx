import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import CallToAction from '../components/landing/CallToAction';

const LandingPage = () => {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-lime-400 selection:text-black">
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>

      <footer className="py-8 text-center text-zinc-500 text-xs font-mono border-t border-[#1f1f23]">
        <p>© 2026 MonoMELT Transformation Platform. Built for OpenAI Build Week.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
