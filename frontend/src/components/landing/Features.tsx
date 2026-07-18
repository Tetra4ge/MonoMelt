
const features = [
  {
    title: 'Advanced AI Analysis',
    description: 'Powered by GPT-5.6, we track data flows, identify bounded contexts, and find transactional boundaries.',
    icon: '🧠'
  },
  {
    title: 'Cost Projections',
    description: 'Calculate exactly how much your new microservices architecture will cost to run on AWS or GCP.',
    icon: '💰'
  },
  {
    title: 'Interactive Blueprints',
    description: 'Drag and drop service boundaries in a visual Neo4j graph before generating K8s manifests.',
    icon: '📊'
  }
];

const Features = () => {
  return (
    <section className="py-24 bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Everything you need to transform</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">No more guessing. Get a mathematically and logically sound migration strategy.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-md hover:border-indigo-500/50 transition-colors">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
