import type { TeamMappingPlan } from '../../features/planning/types';

export default function TeamOwnershipPanel({ mapping }: { mapping: TeamMappingPlan }) {
  return (
    <section className="border border-[#222] bg-[#111] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">team_ownership</p>
      <h2 className="mt-2 text-lg font-bold text-white">&gt; responsibility_map</h2>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">{mapping.team_assignments.map(team => <div key={team.team_name} className="border border-[#222] bg-[#0a0a0a] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-white">{team.team_name}</h3><span className="text-[10px] uppercase text-gray-500">{team.capacity_status}</span></div><p className="mt-3 text-xs text-gray-400">{team.assigned_services.join(', ') || 'no assigned services'}</p>{team.spof_warning && <p className="mt-3 border-t border-[#222] pt-3 text-xs text-gray-500">warning: {team.spof_warning}</p>}</div>)}</div>
      {mapping.unassigned_services.length > 0 && <p className="mt-4 border border-[#333] p-3 text-xs text-gray-400">unassigned: {mapping.unassigned_services.join(', ')}</p>}
    </section>
  );
}
