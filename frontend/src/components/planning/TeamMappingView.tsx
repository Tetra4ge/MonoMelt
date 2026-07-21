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
    <div className="neo-card p-6 sm:p-8 space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h2 className="font-bebas text-2xl text-white tracking-wide flex items-center gap-2">
          <Users className="w-5 h-5 text-[#FF5BB5]" />
          TEAM OWNERSHIP & WORKLOAD MAPPING
        </h2>
        <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
          Service assignments, capacity status, and Single Point of Failure (SPOF) warnings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMapping.team_assignments.map((team, idx) => {
          const isOverloaded = team.capacity_status === 'overloaded';
          return (
            <div 
              key={idx} 
              className="bg-[#181818] rounded-[18px] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bebas text-xl text-white tracking-wide flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#FF5BB5]" />
                    {team.team_name}
                  </h3>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${
                    isOverloaded 
                      ? 'bg-[#FFA62B]/10 text-[#FFA62B]' 
                      : 'bg-[#B8FF45]/10 text-[#B8FF45]'
                  }`}>
                    {team.capacity_status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold text-[#808080] uppercase block">Assigned Services:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {team.assigned_services.map((service, sIdx) => (
                      <span key={sIdx} className="text-xs bg-[#262626] text-white px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                        <Server className="w-3 h-3 text-[#FF5BB5]" />
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {team.spof_warning && (
                <div className="mt-3 bg-[#FFA62B]/10 p-3 rounded-[12px] text-xs text-[#FFA62B] font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
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
