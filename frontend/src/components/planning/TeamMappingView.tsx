import React from 'react';
import { Users, AlertTriangle, CheckCircle, Server } from 'lucide-react';

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
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Team Ownership & Capacity Mapping
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Organizational service assignments, workload distribution, and Single Point of Failure (SPOF) warnings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMapping.team_assignments.map((team, idx) => {
          const isOverloaded = team.capacity_status === 'overloaded';
          return (
            <div 
              key={idx} 
              className={`bg-slate-850/50 border rounded-xl p-5 flex flex-col justify-between transition-all ${
                isOverloaded ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800 hover:border-purple-500/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    {team.team_name}
                  </h3>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize border ${
                    isOverloaded 
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  }`}>
                    {team.capacity_status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <span className="text-xs font-semibold text-slate-400 block">Assigned Services:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {team.assigned_services.map((service, sIdx) => (
                      <span key={sIdx} className="text-xs font-mono bg-slate-800 text-purple-200 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                        <Server className="w-3 h-3 text-purple-400" />
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {team.spof_warning && (
                <div className="mt-2 bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-lg text-xs text-amber-300 flex items-start gap-2">
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
