import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import CallToAction from '../components/landing/CallToAction';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 selection:bg-indigo-500/30">
      {/* 
        This acts as the main container for the landing page.
        It assembles the 4 landing components cleanly.
      */}
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>

      <footer className="py-8 text-center text-slate-500 text-sm border-t border-slate-800/50">
        <p>© 2026 Transformation Intelligence Platform. Built for OpenAI Build Week.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
