import { DollarSign, Zap, TrendingUp } from 'lucide-react';

export interface CostPerformanceSimulation {
  monolith_monthly_cost_usd: number;
  microservices_monthly_cost_usd: number;
  cost_range_min_usd: number;
  cost_range_max_usd: number;
  avg_latency_increase_ms: number;
  sensitivity_drivers: string[];
}

interface CostPerformanceSimulatorProps {
  simulation: CostPerformanceSimulation;
}

export default function CostPerformanceSimulator({ simulation }: CostPerformanceSimulatorProps) {
  return (
    <div className="neo-card p-6 sm:p-8 space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h2 className="font-bebas text-2xl text-white tracking-wide flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#B8FF45]" />
          COST PROJECTION & LATENCY SIMULATOR
        </h2>
        <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
          Comparative infrastructure expenditure and network hop latency penalty
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Monolith Baseline */}
        <div className="bg-[#181818] rounded-[18px] p-5">
          <span className="text-[10px] uppercase font-bold text-[#808080] block">Monolith Baseline</span>
          <div className="text-3xl font-extrabold text-white mt-1 font-inter">
            ${simulation.monolith_monthly_cost_usd.toLocaleString()} <span className="text-xs text-[#808080] font-medium">/mo</span>
          </div>
          <span className="text-[11px] text-[#808080] block mt-2 font-medium">Single deployment container</span>
        </div>

        {/* Target Microservices Cost */}
        <div className="bg-[#181818] border border-[#B8FF45]/30 rounded-[18px] p-5 relative overflow-hidden">
          <span className="text-[10px] text-[#B8FF45] font-bold uppercase block">Microservices Target</span>
          <div className="text-3xl font-extrabold text-[#B8FF45] mt-1 font-inter">
            ${simulation.microservices_monthly_cost_usd.toLocaleString()} <span className="text-xs text-[#BEBEBE] font-medium">/mo</span>
          </div>
          <div className="text-[11px] font-bold mt-2 text-[#BEBEBE]">
            Range: ${simulation.cost_range_min_usd.toLocaleString()} - ${simulation.cost_range_max_usd.toLocaleString()}
          </div>
        </div>

        {/* Latency Overhead */}
        <div className="bg-[#181818] border border-[#FFA62B]/30 rounded-[18px] p-5">
          <span className="text-[10px] text-[#FFA62B] font-bold uppercase block flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#FFA62B]" /> Hop Latency Penalty
          </span>
          <div className="text-3xl font-extrabold text-[#FFA62B] mt-1 font-inter">
            +{simulation.avg_latency_increase_ms} ms
          </div>
          <span className="text-[11px] text-[#808080] block mt-2 font-medium">Inter-service network overhead</span>
        </div>
      </div>

      {/* Sensitivity Drivers */}
      <div className="bg-[#181818] rounded-[18px] p-5 space-y-3">
        <h4 className="font-bebas text-lg text-white tracking-wide flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[#B8FF45]" /> SENSITIVITY DRIVERS & ASSUMPTIONS
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-medium">
          {simulation.sensitivity_drivers.map((driver, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-[#262626] px-4 py-2.5 rounded-full text-[#BEBEBE]">
              <span className="w-2 h-2 rounded-full bg-[#B8FF45] shrink-0"></span>
              {driver}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
