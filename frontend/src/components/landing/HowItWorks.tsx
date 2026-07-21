const steps = [
  { num: '01', title: 'Upload Repository', desc: 'Securely upload your monolith zip or link your GitHub repo.' },
  { num: '02', title: 'AI Generation', desc: 'Our FastAPI engine parses ASTs and uses LLMs to define bounded contexts.' },
  { num: '03', title: 'Select Strategy', desc: 'Choose between Aggressive, Conservative, or Domain-Driven splits.' },
  { num: '04', title: 'Export Code', desc: 'Download ready-to-deploy OpenAPI specs and Kubernetes manifests.' },
];

const HowItWorks = () => {
  return (
    <section className="py-24 border-t border-[#1f1f23]">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="text-3xl lg:text-4xl font-bold font-display text-white mb-16">How it Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="app-card p-6">
              <div className="text-2xl font-extrabold text-lime-400 font-mono mb-4">{step.num}</div>
              <h3 className="text-sm font-bold font-display text-white mb-2">{step.title}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
