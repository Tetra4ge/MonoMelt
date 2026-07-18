
const Hero = () => {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-[#0f172a] -z-10"></div>
      <div className="container mx-auto px-4 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-6 backdrop-blur-sm">
          OpenAI Build Week Challenge 🚀
        </div>
        <h1 className="text-5xl lg:text-7xl font-extrabold text-white tracking-tight mb-8">
          Deconstruct the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Monolith</span>.<br />
          Architect the Future.
        </h1>
        <p className="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The end-to-end intelligence platform that deeply analyzes your legacy codebase and generates a complete, risk-free microservices transformation blueprint.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)]">
            Upload Codebase
          </button>
          <button className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all">
            View Sample Blueprint
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
