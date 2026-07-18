import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import CallToAction from '../components/landing/CallToAction';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-400 selection:bg-emerald-500/30 font-sans">
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>

      <footer className="py-8 text-center text-gray-600 text-sm border-t border-gray-800">
        <p>© 2026 MonoMELT Transformation Platform. Built for OpenAI Build Week.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
