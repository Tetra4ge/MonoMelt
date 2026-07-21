import React, { useState } from 'react';
import { Settings, X, RefreshCw, Sliders } from 'lucide-react';
import { PlanAssumptions } from './RoadmapTimeline';

interface AssumptionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAssumptions: PlanAssumptions;
  onRecalculate: (newAssumptions: PlanAssumptions) => Promise<void>;
}

export default function AssumptionsDrawer({
  isOpen,
  onClose,
  currentAssumptions,
  onRecalculate
}: AssumptionsDrawerProps) {
  const [formData, setFormData] = useState<PlanAssumptions>(currentAssumptions);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRecalculate(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Recalculate Plan Assumptions
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form id="assumptions-form" onSubmit={handleSubmit} className="space-y-5 text-sm">
            {/* Cloud Provider */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Cloud Provider
              </label>
              <select
                value={formData.cloud_provider}
                onChange={(e) => setFormData({ ...formData, cloud_provider: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="aws">AWS (Amazon Web Services)</option>
                <option value="azure">Microsoft Azure</option>
                <option value="gcp">Google Cloud Platform (GCP)</option>
              </select>
            </div>

            {/* Region */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Pricing Region
              </label>
              <input
                type="text"
                value={formData.pricing_region}
                onChange={(e) => setFormData({ ...formData, pricing_region: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Infrastructure Scaling Multiplier */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase justify-between flex">
                <span>Scaling Multiplier</span>
                <span className="text-indigo-400">{formData.cost_multiplier}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={formData.cost_multiplier}
                onChange={(e) => setFormData({ ...formData, cost_multiplier: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Team Count */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Available Engineering Teams
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.team_count}
                onChange={(e) => setFormData({ ...formData, team_count: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Risk Tolerance
              </label>
              <select
                value={formData.risk_tolerance}
                onChange={(e) => setFormData({ ...formData, risk_tolerance: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Low (Recommend Modular Monolith if complex)</option>
                <option value="medium">Medium (Standard Strangler Fig)</option>
                <option value="high">High (Aggressive parallel extractions)</option>
              </select>
            </div>

            {/* Target Window */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase">
                Target Migration Window (Months)
              </label>
              <input
                type="number"
                min="1"
                max="36"
                value={formData.migration_window_months}
                onChange={(e) => setFormData({ ...formData, migration_window_months: parseInt(e.target.value) || 6 })}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </form>
        </div>

        <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assumptions-form"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            {isSubmitting ? 'Recalculating...' : 'Recalculate Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
