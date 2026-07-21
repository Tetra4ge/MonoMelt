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
    <div className="neo-card p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="font-bebas text-2xl text-white tracking-wide flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#B8FF45]" />
            PHASED MIGRATION ROADMAP
          </h2>
          <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
            Recommended Strategy: <span className="font-bold text-[#B8FF45] uppercase">{roadmap.pattern_recommended.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="bg-[#181818] px-4 py-2 rounded-[16px] text-right">
          <span className="text-[10px] text-[#808080] uppercase font-bold block">Target Duration</span>
          <span className="text-lg font-bold text-white flex items-center gap-1.5 font-inter">
            <Calendar className="w-4 h-4 text-[#B8FF45] inline" />
            {roadmap.total_duration_weeks} WEEKS
          </span>
        </div>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#262626]">
        {roadmap.stages.map((stage) => (
          <div key={stage.stage_number} className="relative group">
            {/* Timeline Bullet */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#0B0B0B] border-2 border-[#B8FF45] flex items-center justify-center text-[10px] font-bold text-[#B8FF45] group-hover:bg-[#B8FF45] group-hover:text-black transition-all">
              {stage.stage_number}
            </div>

            <div className="bg-[#181818] rounded-[18px] p-5 transition-all space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bebas text-xl text-white tracking-wide">
                  Stage {stage.stage_number}: {stage.name}
                </h3>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#262626] text-[#B8FF45]">
                  {stage.effort_estimate_weeks} WKS • {stage.rollout_method.toUpperCase().replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-[#BEBEBE] font-medium leading-relaxed">{stage.description}</p>

              {/* Target Services */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-[#808080] uppercase">Target Services:</span>
                {stage.target_services.map((service, idx) => (
                  <span key={idx} className="text-xs bg-[#262626] text-white px-3 py-1 rounded-full font-medium">
                    {service}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs">
                <div className="flex items-start gap-2 text-[#FF5A5F] bg-[#FF5A5F]/10 p-3 rounded-[12px]">
                  <ShieldAlert className="w-4 h-4 text-[#FF5A5F] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase text-[10px]">Rollback Criteria</span>
                    {stage.rollback_condition}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[#B8FF45] bg-[#B8FF45]/10 p-3 rounded-[12px]">
                  <CheckCircle2 className="w-4 h-4 text-[#B8FF45] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase text-[10px]">Success Metric</span>
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
