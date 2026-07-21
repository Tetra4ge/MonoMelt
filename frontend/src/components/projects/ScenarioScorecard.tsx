
interface MetricProps {
  label: string;
  value: string | number;
}

const Metric = ({ label, value }: MetricProps) => (
  <div className="bg-[#0a0a0a] p-3 border border-[#222]">
    <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

export default function ScenarioScorecard({ scenario, proposedServices }: { scenario: { strategy_type: string; created_at: string; status: string }; proposedServices: Array<{ id: string; name: string; description?: string; assigned_nodes: string[]; metrics?: { node_count?: number; internal_edges?: number; external_edges_out?: number } }> }) {
  if (!scenario) return null;
  return (
    <div className="bg-[#111] border border-[#333] p-4 mb-6">
      <div className="flex justify-between items-center mb-4 border-b border-[#222] pb-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {scenario.strategy_type.toUpperCase()} SCENARIO
          </h3>
          <p className="text-gray-400 text-xs">Generated {new Date(scenario.created_at).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-gray-300">Status: {scenario.status.toUpperCase()}</div>
        </div>
      </div>
      
      {scenario.status === 'completed' && proposedServices && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Metric label="Microservices" value={proposedServices.length} />
            <Metric label="Avg Nodes/Service" value={
                proposedServices.length 
                ? (proposedServices.reduce((acc, s) => acc + (s.metrics?.node_count || 0), 0) / proposedServices.length).toFixed(1)
                : 0
            } />
            <Metric label="Avg Internal Cohesion" value={
                 proposedServices.length 
                 ? (proposedServices.reduce((acc, s) => acc + (s.metrics?.internal_edges || 0), 0) / proposedServices.length).toFixed(1)
                 : 0
            } />
             <Metric label="Avg External Coupling" value={
                 proposedServices.length 
                 ? (proposedServices.reduce((acc, s) => acc + (s.metrics?.external_edges_out || 0), 0) / proposedServices.length).toFixed(1)
                 : 0
            } />
          </div>
          
          <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Proposed Boundaries</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {proposedServices.map((service) => (
              <div key={service.id} className="border border-[#222] bg-[#0a0a0a] p-3 hover:border-blue-900 transition-colors">
                <div className="font-bold text-sm mb-1">{service.name}</div>
                <div className="text-xs text-gray-500 mb-2">{service.description}</div>
                <div className="flex gap-2 text-[10px] text-gray-400">
                  <span className="bg-[#111] px-2 py-1 rounded">Nodes: {service.assigned_nodes.length}</span>
                  <span className="bg-[#111] px-2 py-1 rounded">Internal Edges: {service.metrics?.internal_edges || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {scenario.status === 'generating' && (
         <div className="p-8 flex flex-col items-center justify-center">
         <div className="w-8 h-8 border-2 border-[#222] border-t-blue-500 rounded-full animate-spin mb-4"></div>
         <p className="text-gray-400 text-sm">AI Engine is clustering the AST...</p>
       </div>
      )}
    </div>
  );
}
