import { Lock, ShieldCheck, ArrowRight, Activity } from 'lucide-react';

export interface ConsistencySecurityItem {
  source_service: string;
  target_service: string;
  operation_type: string;
  recommended_pattern: string;
  data_category: string;
  encryption_required: boolean;
  audit_required: boolean;
}

export interface ConsistencySecurityMatrixData {
  items: ConsistencySecurityItem[];
  risk_summary: string;
}

interface ConsistencySecurityMatrixProps {
  matrix: ConsistencySecurityMatrixData;
}

export default function ConsistencySecurityMatrix({ matrix }: ConsistencySecurityMatrixProps) {
  return (
    <div className="neo-card p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="font-bebas text-2xl text-white tracking-wide flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#B8FF45]" />
            DATA CONSISTENCY & SECURITY MATRIX
          </h2>
          <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">{matrix.risk_summary}</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#B8FF45]/10 text-[#B8FF45] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> ZERO-TRUST ENFORCED
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-inter border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-[#808080] uppercase tracking-wider text-[10px] font-bold">
              <th className="py-3 px-4">Service Interaction</th>
              <th className="py-3 px-4">Op Type</th>
              <th className="py-3 px-4">Pattern</th>
              <th className="py-3 px-4">Data Category</th>
              <th className="py-3 px-4">Security Rules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-medium">
            {matrix.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-[#252525] transition-colors">
                <td className="py-3.5 px-4 text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-[#B8FF45] bg-[#262626] px-3 py-1 rounded-full text-xs font-semibold">
                      {item.source_service}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#808080]" />
                    <span className="text-[#3B82F6] bg-[#262626] px-3 py-1 rounded-full text-xs font-semibold">
                      {item.target_service}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <span className={`uppercase font-bold text-[10px] px-2.5 py-1 rounded-full ${
                    item.operation_type === 'write' 
                      ? 'bg-[#FFA62B]/10 text-[#FFA62B]' 
                      : 'bg-[#3B82F6]/10 text-[#3B82F6]'
                  }`}>
                    {item.operation_type}
                  </span>
                </td>

                <td className="py-3.5 px-4">
                  <span className="font-bold text-white bg-[#262626] px-3 py-1 rounded-full text-xs">
                    {item.recommended_pattern.toUpperCase()}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-[#BEBEBE] capitalize font-medium">
                  {item.data_category}
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {item.encryption_required && (
                      <span className="text-[#B8FF45] bg-[#B8FF45]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold">
                        <Lock className="w-3 h-3" /> mTLS
                      </span>
                    )}
                    {item.audit_required && (
                      <span className="text-[#FF5BB5] bg-[#FF5BB5]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold">
                        <Activity className="w-3 h-3" /> AUDITED
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
