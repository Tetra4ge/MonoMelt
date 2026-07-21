import React from 'react';
import { Lock, GitCommit, ShieldCheck, ArrowRight, Activity } from 'lucide-react';

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
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            Data Consistency & Security Matrix
          </h2>
          <p className="text-sm text-slate-400 mt-1">{matrix.risk_summary}</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Zero-Trust Verified
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Interaction Path</th>
              <th className="py-3 px-4">Op Type</th>
              <th className="py-3 px-4">Pattern</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Security Rules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {matrix.items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3.5 px-4 text-slate-200">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-indigo-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {item.source_service}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-purple-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {item.target_service}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <span className={`uppercase font-bold text-[10px] px-2 py-0.5 rounded ${
                    item.operation_type === 'write' 
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                      : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                  }`}>
                    {item.operation_type}
                  </span>
                </td>

                <td className="py-3.5 px-4">
                  <span className="font-semibold text-slate-200 bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-md">
                    {item.recommended_pattern.toUpperCase()}
                  </span>
                </td>

                <td className="py-3.5 px-4 text-slate-300 capitalize">
                  {item.data_category}
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    {item.encryption_required && (
                      <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" /> TLS/mTLS
                      </span>
                    )}
                    {item.audit_required && (
                      <span className="text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Audited
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
