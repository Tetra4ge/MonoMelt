import { Server } from 'lucide-react';

interface MetricProps {
  label: string;
  value: string | number;
  colorClass?: string;
}

const Metric = ({ label, value, colorClass = "text-white" }: MetricProps) => (
  <div className="bg-[#0b0b0e] p-4 rounded-2xl border border-[#232328]">
    <div className="text-zinc-500 text-[10px] uppercase font-mono tracking-wider mb-1">{label}</div>
    <div className={`text-2xl font-black font-syne ${colorClass}`}>{value}</div>
  </div>
);

export default function ScenarioScorecard({ scenario, proposedServices }: any) {
  if (!scenario) return null;
  return (
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 mb-6 shadow-2xl space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#222228] pb-4">
        <div>
          <h3 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-lime-400"></span>
            {scenario.strategy_type} SCENARIO DECOMPOSITION
          </h3>
          <p className="text-zinc-400 text-xs font-mono mt-1">Generated {new Date(scenario.created_at).toLocaleString()}</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-[#0b0b0e] border border-[#232328] px-3.5 py-1.5 rounded-full text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-lime-400"></span>
          <span className="font-bold text-lime-300 uppercase">{scenario.status}</span>
        </div>
      </div>
      
      {scenario.status === 'completed' && proposedServices && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Microservices" value={proposedServices.length} colorClass="text-lime-300" />
            <Metric label="Avg Nodes / Service" value={
                proposedServices.length 
                ? (proposedServices.reduce((acc: number, s: any) => acc + (s.metrics?.node_count || 0), 0) / proposedServices.length).toFixed(1)
                : 0
            } colorClass="text-indigo-300" />
            <Metric label="Avg Internal Cohesion" value={
                 proposedServices.length 
                 ? (proposedServices.reduce((acc: number, s: any) => acc + (s.metrics?.internal_edges || 0), 0) / proposedServices.length).toFixed(1)
                 : 0
            } colorClass="text-purple-300" />
             <Metric label="Avg External Coupling" value={
                 proposedServices.length 
                 ? (proposedServices.reduce((acc: number, s: any) => acc + (s.metrics?.external_edges_out || 0), 0) / proposedServices.length).toFixed(1)
                 : 0
            } colorClass="text-orange-300" />
          </div>
          
          <div>
            <h4 className="text-xs font-black font-syne text-zinc-400 mb-3 uppercase tracking-wider">
              PROPOSED SERVICE BOUNDARIES
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {proposedServices.map((service: any) => (
                <div key={service.id} className="border border-[#232328] bg-[#0b0b0e] rounded-2xl p-4 hover:border-lime-500/40 transition-all">
                  <div className="font-bold font-syne text-white text-base mb-1 flex items-center gap-2">
                    <Server className="w-4 h-4 text-lime-400 shrink-0" />
                    {service.name}
                  </div>
                  <div className="text-xs text-zinc-400 mb-3">{service.description}</div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                    <span className="bg-[#16161c] border border-[#25252e] text-zinc-300 px-2.5 py-1 rounded-full">
                      Nodes: {service.assigned_nodes?.length || 0}
                    </span>
                    <span className="bg-[#16161c] border border-[#25252e] text-lime-300 px-2.5 py-1 rounded-full">
                      Internal Edges: {service.metrics?.internal_edges || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {scenario.status === 'generating' && (
        <div className="p-12 flex flex-col items-center justify-center font-mono">
          <div className="w-10 h-10 border-2 border-zinc-800 border-t-lime-400 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400 text-xs">AI Engine is clustering AST nodes into bounded contexts...</p>
        </div>
      )}
    </div>
  );
}
