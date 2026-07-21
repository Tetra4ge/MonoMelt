import type { ChangeEvent, FormEvent } from 'react';
import type { CloudProvider, PlanAssumptions, RiskTolerance } from '../../features/planning/types';

interface PlanSetupProps {
  assumptions: PlanAssumptions;
  disabled: boolean;
  submitLabel: string;
  onChange: (assumptions: PlanAssumptions) => void;
  onSubmit: () => void;
}

export default function PlanSetup({ assumptions, disabled, submitLabel, onChange, onSubmit }: PlanSetupProps) {
  const update = <K extends keyof PlanAssumptions>(key: K, value: PlanAssumptions[K]) => {
    onChange({ ...assumptions, [key]: value });
  };

  const numberChange = (key: 'cost_multiplier' | 'team_count' | 'migration_window_months') =>
    (event: ChangeEvent<HTMLInputElement>) => update(key, Number(event.target.value) as PlanAssumptions[typeof key]);

  const selectChange = (key: 'cloud_provider' | 'risk_tolerance') =>
    (event: ChangeEvent<HTMLSelectElement>) => update(key, event.target.value as PlanAssumptions[typeof key]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="border border-[#222] bg-[#111] p-5 sm:p-6">
      <div className="mb-5 border-b border-[#222] pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">planning / configuration</p>
        <h2 className="mt-2 text-lg font-bold text-white">Execution Parameters</h2>
        <p className="mt-2 text-xs leading-5 text-gray-500">Every generated estimate is calculated from these visible assumptions.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-gray-400">
          Cloud provider
          <select value={assumptions.cloud_provider} onChange={selectChange('cloud_provider')} className="mt-2 w-full border border-[#222] bg-[#0a0a0a] px-3 py-3 text-sm text-white outline-none focus:border-white" disabled={disabled}>
            {(['aws', 'azure', 'gcp'] as CloudProvider[]).map(provider => <option key={provider} value={provider}>{provider.toUpperCase()}</option>)}
          </select>
        </label>

        <label className="text-xs text-gray-400">
          Pricing region
          <input value={assumptions.pricing_region} onChange={event => update('pricing_region', event.target.value)} className="mt-2 w-full border border-[#222] bg-[#0a0a0a] px-3 py-3 text-sm text-white outline-none focus:border-white" disabled={disabled} />
        </label>

        <label className="text-xs text-gray-400">
          Risk tolerance
          <select value={assumptions.risk_tolerance} onChange={selectChange('risk_tolerance')} className="mt-2 w-full border border-[#222] bg-[#0a0a0a] px-3 py-3 text-sm text-white outline-none focus:border-white" disabled={disabled}>
            {(['low', 'medium', 'high'] as RiskTolerance[]).map(risk => <option key={risk} value={risk}>{risk.toUpperCase()}</option>)}
          </select>
        </label>

        <label className="text-xs text-gray-400">
          Cost multiplier: {assumptions.cost_multiplier.toFixed(1)}x
          <input type="number" min="0.5" max="3" step="0.1" value={assumptions.cost_multiplier} onChange={numberChange('cost_multiplier')} className="mt-2 w-full accent-white" disabled={disabled} />
        </label>

        <label className="text-xs text-gray-400">
          Available teams
          <input type="number" min="1" max="20" value={assumptions.team_count} onChange={numberChange('team_count')} className="mt-2 w-full border border-[#222] bg-[#0a0a0a] px-3 py-3 text-sm text-white outline-none focus:border-white" disabled={disabled} />
        </label>

        <label className="text-xs text-gray-400">
          Migration window: {assumptions.migration_window_months} months
          <input type="number" min="1" max="36" value={assumptions.migration_window_months} onChange={numberChange('migration_window_months')} className="mt-2 w-full accent-white" disabled={disabled} />
        </label>
      </div>

      <button type="submit" disabled={disabled} className="mt-6 border border-white bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-40">
        {submitLabel}
      </button>
    </form>
  );
}
