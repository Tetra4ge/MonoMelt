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
    <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="border-b border-[#222228] pb-4">
        <h2 className="text-xl font-black font-syne text-white flex items-center gap-2 uppercase tracking-tight">
          <DollarSign className="w-5 h-5 text-lime-400" />
          COST PROJECTION & LATENCY SIMULATOR
        </h2>
        <p className="text-xs font-mono text-zinc-400 mt-1">
          Comparative infrastructure expenditure and network hop latency penalty
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Monolith Baseline */}
        <div className="bg-[#0b0b0e] border border-[#232328] rounded-2xl p-5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">Monolith Baseline</span>
          <div className="text-3xl font-black font-syne text-zinc-200 mt-1">
            ${simulation.monolith_monthly_cost_usd.toLocaleString()} <span className="text-xs font-mono text-zinc-500 font-normal">/mo</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 block mt-2">Single deployment container</span>
        </div>

        {/* Target Microservices Cost */}
        <div className="bg-[#0b0b0e] border border-lime-500/40 rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[10px] font-mono text-lime-400 font-bold uppercase block">Microservices Target</span>
          <div className="text-3xl font-black font-syne text-white mt-1">
            ${simulation.microservices_monthly_cost_usd.toLocaleString()} <span className="text-xs font-mono text-zinc-400 font-normal">/mo</span>
          </div>
          <div className="text-[11px] font-mono font-bold mt-2 text-lime-300">
            Range: ${simulation.cost_range_min_usd.toLocaleString()} - ${simulation.cost_range_max_usd.toLocaleString()}
          </div>
        </div>

        {/* Latency Overhead */}
        <div className="bg-[#0b0b0e] border border-orange-500/40 rounded-2xl p-5">
          <span className="text-[10px] font-mono text-orange-400 font-bold uppercase block flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-orange-400" /> Hop Latency Penalty
          </span>
          <div className="text-3xl font-black font-syne text-orange-300 mt-1">
            +{simulation.avg_latency_increase_ms} ms
          </div>
          <span className="text-[11px] font-mono text-zinc-500 block mt-2">Inter-service network overhead</span>
        </div>
      </div>

      {/* Sensitivity Drivers */}
      <div className="bg-[#0b0b0e] border border-[#232328] rounded-2xl p-5 space-y-3 font-mono">
        <h4 className="text-xs font-black font-syne text-white uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-lime-400" /> SENSITIVITY DRIVERS & ASSUMPTIONS
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {simulation.sensitivity_drivers.map((driver, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-[#16161c] px-3.5 py-2 rounded-xl border border-[#232328] text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-lime-400 shrink-0"></span>
              {driver}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
