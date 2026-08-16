import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface PipelineVisualizerProps {
  status: 'building' | 'provisioning' | 'deploying' | 'deployed' | 'failed';
}

const STAGES = [
  { id: 'building', label: '1. Building Images' },
  { id: 'provisioning', label: '2. Provisioning Infrastructure' },
  { id: 'deploying', label: '3. Starting Services' },
  { id: 'health', label: '4. Health Checks' }
];

export default function PipelineVisualizer({ status }: PipelineVisualizerProps) {
  // Determine current active index based on backend status
  let activeIndex = 0;
  if (status === 'provisioning') activeIndex = 1;
  if (status === 'deploying') activeIndex = 2;
  if (status === 'deployed') activeIndex = 4; // all done

  return (
    <div className="bg-[#111] border border-[#222] rounded-md p-6 shadow-2xl mb-6">
      <h3 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Deployment Pipeline</h3>
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {STAGES.map((stage, index) => {
          const isCompleted = index < activeIndex || status === 'deployed';
          const isActive = index === activeIndex && status !== 'deployed';

          return (
            <div key={stage.id} className="flex items-center gap-3 flex-1">
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-700" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-xs font-bold uppercase tracking-wider ${isCompleted || isActive ? 'text-white' : 'text-gray-600'}`}>
                  {stage.label}
                </div>
                {isActive && (
                  <div className="h-0.5 w-full bg-blue-500/20 mt-2 overflow-hidden rounded-full">
                    <div className="h-full bg-blue-500 w-1/2 animate-[pulse_1s_ease-in-out_infinite]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
