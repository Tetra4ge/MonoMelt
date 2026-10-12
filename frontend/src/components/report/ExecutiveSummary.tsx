import { Activity, Clock, AlertTriangle } from 'lucide-react';

export const ExecutiveSummary = ({ data }: { data: any }) => {
  if (!data) return null;

  const riskColor = data.overall_risk_score === 'HIGH' ? 'text-red-500' 
                  : data.overall_risk_score === 'MEDIUM' ? 'text-yellow-500' 
                  : 'text-emerald-500';

  return (
    <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide">&gt; executive_summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0a0a0a] border border-[#333] p-4 flex items-center gap-4 group hover:border-blue-500 transition-colors">
          <Activity className="w-8 h-8 text-blue-500 group-hover:text-blue-400 transition-colors" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Services</p>
            <p className="text-2xl font-bold text-white">{data.total_services_extracted}</p>
          </div>
        </div>
        
        <div className="bg-[#0a0a0a] border border-[#333] p-4 flex items-center gap-4 group hover:border-emerald-500 transition-colors">
          <Clock className="w-8 h-8 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Est. Timeline</p>
            <p className="text-2xl font-bold text-white">{data.estimated_timeline_months} mo</p>
          </div>
        </div>

        <div className={`bg-[#0a0a0a] border border-[#333] p-4 flex items-center gap-4 group hover:border-gray-500 transition-colors`}>
          <AlertTriangle className={`w-8 h-8 ${riskColor}`} />
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Risk Score</p>
            <p className={`text-2xl font-bold ${riskColor}`}>{data.overall_risk_score}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#333] p-6 rounded-sm">
        <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-widest">Business Impact</h3>
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
          {data.business_impact}
        </p>
      </div>
    </div>
  );
};
