import type { RoadmapPlan } from '../../features/planning/types';

export default function RoadmapTimeline({ roadmap }: { roadmap: RoadmapPlan }) {
  return (
    <section className="border border-[#222] bg-[#111] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 border-b border-[#222] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.2em] text-gray-500">migration_roadmap</p><h2 className="mt-2 text-lg font-bold text-white">&gt; execution_sequence</h2></div>
        <p className="text-xs text-gray-400">pattern: <span className="text-white">{roadmap.pattern_recommended}</span> / {roadmap.total_duration_weeks} weeks</p>
      </div>
      <div className="space-y-3">
        {roadmap.stages.map(stage => (
          <article key={stage.stage_number} className="border border-[#222] bg-[#0a0a0a] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-bold text-white">[{String(stage.stage_number).padStart(2, '0')}] {stage.name}</h3>
              <span className="text-xs text-gray-500">{stage.effort_estimate_weeks} weeks / {stage.rollout_method}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-400">{stage.description}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div><span className="text-gray-600">targets</span><p className="mt-1 text-gray-300">{stage.target_services.join(', ') || 'none'}</p></div>
              <div><span className="text-gray-600">rollback</span><p className="mt-1 text-gray-300">{stage.rollback_condition}</p></div>
              <div><span className="text-gray-600">success</span><p className="mt-1 text-gray-300">{stage.success_metric}</p></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
