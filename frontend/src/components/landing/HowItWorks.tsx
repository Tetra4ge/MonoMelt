const steps = [
  { num: '01', title: 'Upload', desc: 'Send a ZIP archive or a public GitHub repository. The worker checks the archive and stores the source files.' },
  { num: '02', title: 'Analyse', desc: 'The AI service parses every file, resolves its imports and writes the dependency graph to Neo4j, with metrics and parser diagnostics.' },
  { num: '03', title: 'Understand', desc: 'The LLM proposes domains, risks and sensitive data. You approve or reject each finding.' },
  { num: '04', title: 'Decompose', desc: 'Compare conservative, aggressive and domain-driven service splits, with the files, links and cohesion of each service.' },
  { num: '05', title: 'Plan', desc: 'Pick a split and get the roadmap, cost and latency model, team ownership and consistency patterns. Change the assumptions and recalculate.' },
  { num: '06', title: 'Export', desc: 'Download the blueprint ZIP, preview its files, and read the executive report in the dashboard or in Notion.' },
];

const HowItWorks = () => {
  return (
    <section className="py-24 border-t border-[#222]">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-16">How it works</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="p-6 bg-[#111] border border-[#222] rounded-sm">
              <div className="text-3xl font-black text-gray-700 mb-6">{step.num}</div>
              <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
