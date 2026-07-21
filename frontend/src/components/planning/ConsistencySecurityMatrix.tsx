import React from 'react';
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
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222228] pb-4">
        <div>
          <h2 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
            <Lock className="w-5 h-5 text-lime-400" />
            DATA CONSISTENCY & SECURITY MATRIX
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">{matrix.risk_summary}</p>
        </div>
        <span className="text-[11px] font-mono font-bold px-3 py-1.5 rounded-full bg-lime-400/10 text-lime-300 border border-lime-500/30 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> ZERO-TRUST ENFORCED
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-[#222228] text-zinc-500 uppercase tracking-wider">
              <th className="py-3 px-4">Service Interaction</th>
              <th className="py-3 px-4">Op Type</th>
              <th className="py-3 px-4">Pattern</th>
              <th className="py-3 px-4">Data Category</th>
              <th className="py-3 px-4">Security Rules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e24] font-medium">
            {matrix.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-[#0b0b0e] transition-colors">
                <td className="py-3.5 px-4 text-zinc-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lime-300 bg-[#16161c] px-2.5 py-1 rounded-md border border-[#282832]">
                      {item.source_service}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-indigo-300 bg-[#16161c] px-2.5 py-1 rounded-md border border-[#282832]">
                      {item.target_service}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <span className={`uppercase font-bold text-[10px] px-2.5 py-1 rounded-full ${
                    item.operation_type === 'write' 
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' 
                      : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {item.operation_type}
                  </span>
                </td>

                <td className="py-3.5 px-4">
                  <span className="font-bold text-zinc-100 bg-[#1e1e26] border border-[#2e2e3a] px-3 py-1 rounded-full text-[11px]">
                    {item.recommended_pattern.toUpperCase()}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-zinc-300 capitalize">
                  {item.data_category}
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {item.encryption_required && (
                      <span className="text-lime-400 bg-lime-950/30 border border-lime-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px]">
                        <Lock className="w-3 h-3" /> mTLS
                      </span>
                    )}
                    {item.audit_required && (
                      <span className="text-purple-300 bg-purple-950/30 border border-purple-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px]">
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
