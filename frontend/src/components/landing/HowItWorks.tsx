
const steps = [
  { num: '01', title: 'Upload Repository', desc: 'Securely upload your monolith zip or link your GitHub repo.' },
  { num: '02', title: 'AI Generation', desc: 'Our FastAPI engine parses ASTs and uses LLMs to define bounded contexts.' },
  { num: '03', title: 'Select Strategy', desc: 'Choose between Aggressive, Conservative, or Domain-Driven splits.' },
  { num: '04', title: 'Export Code', desc: 'Download ready-to-deploy OpenAPI specs and Kubernetes manifests.' },
];

const HowItWorks = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl lg:text-4xl font-bold text-white text-center mb-16">How it Works</h2>
        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {steps.map((step, idx) => (
            <div key={idx} className="relative p-6">
              <div className="text-6xl font-black text-slate-800/50 mb-4">{step.num}</div>
              <h3 className="text-lg font-bold text-indigo-300 mb-2">{step.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
