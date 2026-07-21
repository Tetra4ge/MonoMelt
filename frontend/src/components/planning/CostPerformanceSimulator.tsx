import React from 'react';
import { DollarSign, Zap, TrendingUp, Cpu } from 'lucide-react';

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
  const costDiff = simulation.microservices_monthly_cost_usd - simulation.monolith_monthly_cost_usd;
  const isHigher = costDiff > 0;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Cost Projection & Performance Simulator
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Comparative resource cost and inter-service network latency estimation
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Monolith Baseline */}
        <div className="bg-slate-850/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block font-medium">Monolith Baseline</span>
          <div className="text-2xl font-black text-slate-200 mt-1">
            ${simulation.monolith_monthly_cost_usd.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/mo</span>
          </div>
          <span className="text-xs text-slate-500 block mt-2">Single deployment unit</span>
        </div>

        {/* Target Microservices Cost */}
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4">
          <span className="text-xs text-indigo-300 block font-medium">Microservices Target</span>
          <div className="text-2xl font-black text-indigo-200 mt-1">
            ${simulation.microservices_monthly_cost_usd.toLocaleString()} <span className="text-xs text-indigo-400 font-normal">/mo</span>
          </div>
          <div className="text-xs font-semibold mt-2 flex items-center gap-1 text-indigo-300">
            Range: ${simulation.cost_range_min_usd.toLocaleString()} - ${simulation.cost_range_max_usd.toLocaleString()}
          </div>
        </div>

        {/* Network Hop Latency Impact */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4">
          <span className="text-xs text-amber-300 block font-medium flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Latency Overhead
          </span>
          <div className="text-2xl font-black text-amber-200 mt-1">
            +{simulation.avg_latency_increase_ms} ms
          </div>
          <span className="text-xs text-amber-300/80 block mt-2">Inter-service network hop penalty</span>
        </div>
      </div>

      {/* Sensitivity Drivers */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" /> Sensitivity Drivers & Assumptions
        </h4>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
          {simulation.sensitivity_drivers.map((driver, idx) => (
            <li key={idx} className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800/80">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              {driver}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
