import { AlertOctagon, ShieldAlert, Wrench } from 'lucide-react';

interface RiskAssessmentData {
  critical_paths: string[];
  data_consistency_flags: string[];
  mitigation_strategies: string[];
}

export const RiskMatrix = ({ data }: { data?: RiskAssessmentData | null }) => {
  if (!data) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 tracking-wide">&gt; risk_assessment</h2>
        <p className="text-gray-500 text-xs">Risk data unavailable.</p>
      </div>
    );
  }

  const { critical_paths, data_consistency_flags, mitigation_strategies } = data;

  return (
    <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide">&gt; risk_assessment</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0a0a0a] border border-[#333] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertOctagon className="w-4 h-4 text-red-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Critical Paths</h3>
          </div>
          {critical_paths.length === 0 ? (
            <p className="text-gray-600 text-xs">None flagged.</p>
          ) : (
            <ul className="space-y-2">
              {critical_paths.map((path, idx) => (
                <li key={idx} className="text-red-300 text-xs font-mono border-l-2 border-red-500/40 pl-3">
                  {path}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#0a0a0a] border border-[#333] p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-yellow-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Consistency Flags</h3>
          </div>
          {data_consistency_flags.length === 0 ? (
            <p className="text-gray-600 text-xs">None flagged.</p>
          ) : (
            <ul className="space-y-2">
              {data_consistency_flags.map((flag, idx) => (
                <li key={idx} className="text-yellow-300 text-xs font-mono border-l-2 border-yellow-500/40 pl-3">
                  {flag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#0a0a0a] border border-[#333] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Mitigation Strategies</h3>
          </div>
          <ul className="space-y-2">
            {mitigation_strategies.map((strategy, idx) => (
              <li key={idx} className="text-gray-300 text-xs leading-relaxed">
                {strategy}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
