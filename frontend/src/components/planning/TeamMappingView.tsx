import { Users, AlertTriangle, Server } from 'lucide-react';

export interface TeamAssignment {
  team_name: string;
  assigned_services: string[];
  capacity_status: string;
  spof_warning?: string | null;
}

export interface TeamMappingPlan {
  team_assignments: TeamAssignment[];
  unassigned_services: string[];
}

interface TeamMappingViewProps {
  teamMapping: TeamMappingPlan;
}

export default function TeamMappingView({ teamMapping }: TeamMappingViewProps) {
  return (
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="border-b border-[#222228] pb-4">
        <h2 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
          <Users className="w-5 h-5 text-purple-400" />
          TEAM OWNERSHIP & WORKLOAD MAPPING
        </h2>
        <p className="text-xs font-mono text-zinc-400 mt-1">
          Service assignments, capacity status, and Single Point of Failure (SPOF) warnings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
        {teamMapping.team_assignments.map((team, idx) => {
          const isOverloaded = team.capacity_status === 'overloaded';
          return (
            <div 
              key={idx} 
              className={`bg-[#0b0b0e] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                isOverloaded ? 'border-orange-500/40' : 'border-[#232328] hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black font-syne text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    {team.team_name}
                  </h3>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase border ${
                    isOverloaded 
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' 
                      : 'bg-lime-500/10 text-lime-300 border-lime-500/30'
                  }`}>
                    {team.capacity_status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block">Assigned Services:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {team.assigned_services.map((service, sIdx) => (
                      <span key={sIdx} className="text-xs bg-[#16161c] text-purple-200 px-2.5 py-1 rounded-full border border-[#282832] flex items-center gap-1.5">
                        <Server className="w-3 h-3 text-purple-400" />
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {team.spof_warning && (
                <div className="mt-3 bg-amber-950/30 border border-amber-900/40 p-3 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{team.spof_warning}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
