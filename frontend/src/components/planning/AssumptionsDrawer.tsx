import { useState } from 'react';
import { X, RefreshCw, SlidersHorizontal } from 'lucide-react';

export interface PlanAssumptions {
  cloud_provider: string;
  pricing_region: string;
  cost_multiplier: number;
  team_count: number;
  risk_tolerance: string;
  migration_window_months: number;
}

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-md flex justify-end font-inter">
      <div className="w-full max-w-md bg-[#1E1E1E] border-l border-white/5 h-full p-6 sm:p-8 overflow-y-auto flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
        <div>
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
            <h3 className="font-bebas text-2xl text-white flex items-center gap-2 tracking-wide">
              <SlidersHorizontal className="w-5 h-5 text-[#B8FF45]" />
              PLAN ASSUMPTIONS
            </h3>
            <button
              onClick={onClose}
              className="text-[#BEBEBE] hover:text-white p-2 rounded-full bg-[#181818] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form id="assumptions-form" onSubmit={handleSubmit} className="space-y-5 text-xs font-medium">
            {/* Cloud Provider */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase">
                Cloud Provider Catalog
              </label>
              <select
                value={formData.cloud_provider}
                onChange={(e) => setFormData({ ...formData, cloud_provider: e.target.value })}
                className="w-full bg-[#181818] text-white rounded-[12px] px-3.5 py-2.5 outline-none border border-transparent focus:border-[#B8FF45]"
              >
                <option value="aws">AWS (Amazon Web Services)</option>
                <option value="azure">Microsoft Azure</option>
                <option value="gcp">Google Cloud Platform (GCP)</option>
              </select>
            </div>

            {/* Region */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase">
                Pricing Region
              </label>
              <input
                type="text"
                value={formData.pricing_region}
                onChange={(e) => setFormData({ ...formData, pricing_region: e.target.value })}
                className="w-full bg-[#181818] text-white rounded-[12px] px-3.5 py-2.5 outline-none border border-transparent focus:border-[#B8FF45]"
              />
            </div>

            {/* Infrastructure Scaling Multiplier */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase justify-between flex">
                <span>Infrastructure Scaling</span>
                <span className="text-[#B8FF45] font-bold">{formData.cost_multiplier}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={formData.cost_multiplier}
                onChange={(e) => setFormData({ ...formData, cost_multiplier: parseFloat(e.target.value) })}
                className="w-full accent-[#B8FF45] cursor-pointer"
              />
            </div>

            {/* Team Count */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase">
                Available Engineering Teams
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.team_count}
                onChange={(e) => setFormData({ ...formData, team_count: parseInt(e.target.value) || 1 })}
                className="w-full bg-[#181818] text-white rounded-[12px] px-3.5 py-2.5 outline-none border border-transparent focus:border-[#B8FF45]"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase">
                Organizational Risk Tolerance
              </label>
              <select
                value={formData.risk_tolerance}
                onChange={(e) => setFormData({ ...formData, risk_tolerance: e.target.value })}
                className="w-full bg-[#181818] text-white rounded-[12px] px-3.5 py-2.5 outline-none border border-transparent focus:border-[#B8FF45]"
              >
                <option value="low">Low (Recommend Modular Monolith if complex)</option>
                <option value="medium">Medium (Standard Strangler Fig)</option>
                <option value="high">High (Aggressive parallel extractions)</option>
              </select>
            </div>

            {/* Target Window */}
            <div>
              <label className="block text-[10px] font-bold text-[#808080] mb-1.5 uppercase">
                Target Migration Window (Months)
              </label>
              <input
                type="number"
                min="1"
                max="36"
                value={formData.migration_window_months}
                onChange={(e) => setFormData({ ...formData, migration_window_months: parseInt(e.target.value) || 6 })}
                className="w-full bg-[#181818] text-white rounded-[12px] px-3.5 py-2.5 outline-none border border-transparent focus:border-[#B8FF45]"
              />
            </div>
          </form>
        </div>

        <div className="pt-6 border-t border-white/5 flex items-center justify-end gap-3 font-medium">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs text-[#BEBEBE] hover:text-white hover:bg-[#252525] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assumptions-form"
            disabled={isSubmitting}
            className="neo-btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
            {isSubmitting ? 'Recalculating...' : 'Recalculate Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
