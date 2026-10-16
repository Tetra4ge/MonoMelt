import { Network, Layers, Route, ShieldCheck, Package, FileText } from 'lucide-react';

const features = [
  {
    title: 'A dependency graph from real code',
    description: 'Parses Python, JavaScript and TypeScript, resolves every import to the file it points to, and stores the graph in Neo4j with cycles, components and unresolved imports measured.',
    icon: Network
  },
  {
    title: 'Service boundaries you can compare',
    description: 'Conservative, aggressive and domain-driven splits, computed from how the files are connected. Each proposed service shows its files, its internal and cross-service links, and its cohesion.',
    icon: Layers
  },
  {
    title: 'A plan, not just a diagram',
    description: 'A coupling-ordered roadmap, a cost and latency model driven by your assumptions, team ownership with capacity warnings, and the data-consistency pattern for each cross-service write.',
    icon: Route
  },
  {
    title: 'AI findings with human review',
    description: 'The LLM flags bounded contexts, architectural risks and sensitive data, each with a confidence score. Nothing is accepted automatically: every finding is approved or rejected by a person.',
    icon: ShieldCheck
  },
  {
    title: 'Starter files for the new services',
    description: 'A blueprint ZIP with a service scaffold and Dockerfile per service, Kubernetes manifests, OpenAPI and event contracts, gateway routes, ADRs, and a draft Terraform setup for AWS, Azure or GCP.',
    icon: Package
  },
  {
    title: 'An executive report for everyone',
    description: 'A versioned report with the cost multiplier, timeline, risk score and per-service dependencies. It updates live in the dashboard and can be exported to Notion.',
    icon: FileText
  }
];

const Features = () => {
  return (
    <section className="py-24 border-t border-[#222] bg-[#0a0a0a]">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Everything you need to transform</h2>
          <p className="text-gray-400 max-w-2xl">Each decision is backed by the code itself. Every number traces back to the graph or to an assumption you can change.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const IconComponent = feature.icon;
            return (
            <div key={idx} className="p-8 bg-[#111] border border-[#222] rounded-sm group hover:border-gray-500 transition-colors">
              <div className="mb-6 text-white group-hover:scale-105 transition-transform origin-left">
                <IconComponent className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
};

export default Features;
