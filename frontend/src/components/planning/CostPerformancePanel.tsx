import type { CostPerformanceSimulation } from '../../features/planning/types';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function CostPerformancePanel({ data }: { data: CostPerformanceSimulation }) {
  const metrics = [
    ['monolith / month', money(data.monolith_monthly_cost_usd)],
    ['microservices / month', money(data.microservices_monthly_cost_usd)],
    ['target cost range', `${money(data.cost_range_min_usd)} — ${money(data.cost_range_max_usd)}`],
    ['latency delta', `+${data.avg_latency_increase_ms} ms`],
  ];
  return (
    <section className="border border-[#222] bg-[#111] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">cost_performance</p>
      <h2 className="mt-2 text-lg font-bold text-white">&gt; impact_model</h2>
      <div className="mt-5 grid grid-cols-1 gap-px border border-[#222] bg-[#222] sm:grid-cols-2">
        {metrics.map(([label, value]) => <div key={label} className="bg-[#0a0a0a] p-4"><p className="text-[10px] uppercase tracking-wider text-gray-600">{label}</p><p className="mt-2 text-lg font-bold text-white">{value}</p></div>)}
      </div>
      <div className="mt-5"><p className="text-xs uppercase tracking-wider text-gray-600">sensitivity drivers</p><ul className="mt-2 space-y-2 text-xs text-gray-400">{data.sensitivity_drivers.map(driver => <li key={driver}>- {driver}</li>)}</ul></div>
    </section>
  );
}
