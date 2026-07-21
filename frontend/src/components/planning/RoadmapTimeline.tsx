import React from 'react';
import { Calendar, CheckCircle2, ShieldAlert, ArrowRight, Layers } from 'lucide-react';

export interface MigrationStage {
  stage_number: int;
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
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Phased Migration Roadmap
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Recommended pattern: <span className="font-semibold text-indigo-300 uppercase tracking-wide">{roadmap.pattern_recommended.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="bg-indigo-950/60 border border-indigo-500/30 px-4 py-2 rounded-xl text-right">
          <span className="text-xs text-indigo-300 block font-medium">Estimated Timeline</span>
          <span className="text-lg font-extrabold text-white flex items-center gap-1">
            <Calendar className="w-4 h-4 text-indigo-400 inline" />
            {roadmap.total_duration_weeks} Weeks
          </span>
        </div>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-500/30">
        {roadmap.stages.map((stage) => (
          <div key={stage.stage_number} className="relative group">
            {/* Timeline Bullet */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-[10px] font-bold text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              {stage.stage_number}
            </div>

            <div className="bg-slate-850/50 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-5 transition-all">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>Stage {stage.stage_number}: {stage.name}</span>
                </h3>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {stage.effort_estimate_weeks} wks • {stage.rollout_method.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm text-slate-300 mb-4">{stage.description}</p>

              {/* Target Services Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-slate-400">Target Services:</span>
                {stage.target_services.map((service, idx) => (
                  <span key={idx} className="text-xs font-mono bg-slate-800 text-indigo-300 px-2.5 py-0.5 rounded-md border border-slate-700">
                    {service}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                <div className="flex items-start gap-2 text-rose-300/90 bg-rose-950/30 border border-rose-900/40 p-2.5 rounded-lg">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-rose-200">Rollback Criteria</span>
                    {stage.rollback_condition}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-emerald-300/90 bg-emerald-950/30 border border-emerald-900/40 p-2.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-emerald-200">Success Metric</span>
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
