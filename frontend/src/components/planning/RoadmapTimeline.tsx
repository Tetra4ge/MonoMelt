import { Calendar, CheckCircle2, ShieldAlert, Layers } from 'lucide-react';

export interface MigrationStage {
  stage_number: number;
  name: string;
  description: string;
  target_services: string[];
  effort_estimate_weeks: number;
  rollout_method: string;
  rollback_condition: string;
  success_metric: string;
}

export interface RoadmapPlan {
  pattern_recommended: string;
  total_duration_weeks: number;
  stages: MigrationStage[];
}

interface RoadmapTimelineProps {
  roadmap: RoadmapPlan;
}

export default function RoadmapTimeline({ roadmap }: RoadmapTimelineProps) {
  return (
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222228] pb-4">
        <div>
          <h2 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
            <Layers className="w-5 h-5 text-lime-400" />
            PHASED MIGRATION ROADMAP
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Recommended Strategy: <span className="font-bold text-lime-300 uppercase">{roadmap.pattern_recommended.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="bg-[#0b0b0e] border border-[#232328] px-4 py-2 rounded-2xl text-right font-mono">
          <span className="text-[10px] text-zinc-500 uppercase font-bold block">Target Duration</span>
          <span className="text-lg font-black text-white flex items-center gap-1.5 font-syne">
            <Calendar className="w-4 h-4 text-lime-400 inline" />
            {roadmap.total_duration_weeks} WEEKS
          </span>
        </div>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#282830]">
        {roadmap.stages.map((stage) => (
          <div key={stage.stage_number} className="relative group">
            {/* Timeline Bullet */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#08080a] border-2 border-lime-400 flex items-center justify-center text-[10px] font-black text-lime-400 group-hover:bg-lime-400 group-hover:text-black transition-all">
              {stage.stage_number}
            </div>

            <div className="bg-[#0b0b0e] border border-[#232328] hover:border-zinc-700 rounded-2xl p-5 transition-all space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-extrabold font-syne text-white">
                  Stage {stage.stage_number}: {stage.name}
                </h3>
                <span className="text-[10px] font-bold font-mono px-3 py-1 rounded-full bg-[#181820] text-lime-300 border border-[#282836]">
                  {stage.effort_estimate_weeks} WKS • {stage.rollout_method.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">{stage.description}</p>

              {/* Target Services */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase">Target Services:</span>
                {stage.target_services.map((service, idx) => (
                  <span key={idx} className="text-[11px] font-mono bg-[#16161c] text-zinc-200 px-2.5 py-0.5 rounded-full border border-[#262630]">
                    {service}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#1a1a20] text-xs font-mono">
                <div className="flex items-start gap-2 text-rose-300 bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-rose-200 uppercase text-[10px]">Rollback Criteria</span>
                    {stage.rollback_condition}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-lime-300 bg-lime-950/20 border border-lime-900/30 p-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-lime-200 uppercase text-[10px]">Success Metric</span>
                    {stage.success_metric}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
