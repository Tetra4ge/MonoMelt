import type { ConsistencySecurityMatrix } from '../../features/planning/types';

export default function ConsistencyMatrix({ matrix }: { matrix: ConsistencySecurityMatrix }) {
  return (
    <section className="border border-[#222] bg-[#111] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">consistency_security</p>
      <h2 className="mt-2 text-lg font-bold text-white">&gt; boundary_controls</h2>
      <p className="mt-3 border-l border-[#444] pl-3 text-xs leading-5 text-gray-400">{matrix.risk_summary}</p>
      <div className="mt-5 space-y-2">
        {matrix.items.map((item, index) => <div key={`${item.source_service}-${item.target_service}-${index}`} className="border border-[#222] bg-[#0a0a0a] p-3 text-xs"><div className="flex flex-wrap gap-x-3 gap-y-1 text-white"><span>{item.source_service} -&gt; {item.target_service}</span><span className="text-gray-500">[{item.operation_type}]</span></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider"><span className="border border-[#333] px-2 py-1 text-gray-300">pattern: {item.recommended_pattern}</span><span className="border border-[#333] px-2 py-1 text-gray-400">data: {item.data_category}</span>{item.encryption_required && <span className="border border-[#333] px-2 py-1 text-gray-300">encrypted</span>}{item.audit_required && <span className="border border-[#333] px-2 py-1 text-gray-300">audited</span>}</div></div>)}
        {matrix.items.length === 0 && <p className="text-xs text-gray-600">No cross-service boundaries reported.</p>}
      </div>
    </section>
  );
}
