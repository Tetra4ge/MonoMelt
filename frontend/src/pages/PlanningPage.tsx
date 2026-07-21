import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react',
import RoadmapTimeline from '../components/planning/RoadmapTimeline';
import ConsistencySecurityMatrix from '../components/planning/ConsistencySecurityMatrix';
import CostPerformanceSimulator from '../components/planning/CostPerformanceSimulator';
import TeamMappingView from '../components/planning/TeamMappingView';
import AssumptionsDrawer from '../components/planning/AssumptionsDrawer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { 
  ArrowLeft, 
  Layers, 
  Plus, 
  Sliders, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

export default function PlanningPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [activeRevision, setActiveRevision] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchPlansAndScenarios();
  }, [projectId]);

  const fetchPlansAndScenarios = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Scenarios & Plans
      const [scenariosRes, plansRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/scenarios`),
        api.get(`/api/projects/${projectId}/plans`)
      ]);

      if (scenariosRes.data.success) {
        setScenarios(scenariosRes.data.data || []);
      }

      if (plansRes.data.success && plansRes.data.data?.length > 0) {
        const fetchedPlans = plansRes.data.data;
        setPlans(fetchedPlans);

        const latestPlan = fetchedPlans[0];
        setActivePlan(latestPlan);

        const revs = latestPlan.plan_revisions || [];
        const selectedRev = revs.find((r: any) => r.is_selected) || revs[0];
        setActiveRevision(selectedRev);
      }
    } catch (err: any) {
      console.error("Failed to load plans", err);
      setError(err.response?.data?.error || "Failed to load migration plans");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!scenarios || scenarios.length === 0) {
      alert("No decomposition scenario found. Please create a scenario first!");
      return;
    }

    const scenarioToUse = scenarios.find(s => s.status === 'completed') || scenarios[0];
    if (!scenarioToUse) {
      alert("No valid scenario available.");
      return;
    }

    try {
      setIsGenerating(true);
      const res = await api.post(`/api/projects/${projectId}/scenarios/${scenarioToUse.id}/plans`, {
        title: `Migration Strategy Report - ${new Date().toLocaleDateString()}`
      });

      if (res.data.success) {
        await fetchPlansAndScenarios();
      }
    } catch (err: any) {
      console.error("Failed to generate plan", err);
      alert(err.response?.data?.error || "Failed to create migration plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecalculate = async (newAssumptions: any) => {
    if (!activePlan) return;

    try {
      const res = await api.post(`/api/projects/${projectId}/plans/${activePlan.id}/assumptions`, {
        assumptions: newAssumptions
      });

      if (res.data.success) {
        const newRev = res.data.data;
        setActiveRevision(newRev);
        await fetchPlansAndScenarios();
      }
    } catch (err: any) {
      console.error("Failed to recalculate plan", err);
      alert(err.response?.data?.error || "Failed to recalculate plan");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-slate-300 font-medium">Loading Migration Plans...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <button
            onClick={() => navigate(`/dashboard/projects/${projectId}/analysis`)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Code Analysis
          </button>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-400" />
            Phase 6: Migration Planning Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Actionable migration roadmap, data consistency matrix, cost simulation, and team ownership assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeRevision && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all"
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              Adjust Assumptions
            </button>
          )}

          <button
            onClick={handleCreatePlan}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate Migration Plan
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/60 p-4 rounded-xl text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      {!activeRevision ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-indigo-950/60 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/30">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">No Migration Plan Generated Yet</h3>
          <p className="text-sm text-slate-400">
            Generate an actionable migration strategy from your completed microservice decomposition scenario.
          </p>
          <button
            onClick={handleCreatePlan}
            disabled={isGenerating}
            className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Generate Plan Now
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Plan Revisions Selector Bar */}
          {activePlan?.plan_revisions && activePlan.plan_revisions.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400">Revisions:</span>
              {activePlan.plan_revisions.map((rev: any) => (
                <button
                  key={rev.id}
                  onClick={() => setActiveRevision(rev)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    activeRevision?.id === rev.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  Rev #{rev.revision_number} ({new Date(rev.created_at).toLocaleTimeString()})
                </button>
              ))}
            </div>
          )}

          {/* Component Grid */}
          {activeRevision.roadmap && (
            <RoadmapTimeline roadmap={activeRevision.roadmap} />
          )}

          {activeRevision.consistency_security && (
            <ConsistencySecurityMatrix matrix={activeRevision.consistency_security} />
          )}

          {activeRevision.cost_performance && (
            <CostPerformanceSimulator simulation={activeRevision.cost_performance} />
          )}

          {activeRevision.team_mapping && (
            <TeamMappingView teamMapping={activeRevision.team_mapping} />
          )}

          {/* Assumptions Drawer */}
          <AssumptionsDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            currentAssumptions={activeRevision.assumptions || {}}
            onRecalculate={handleRecalculate}
          />
        </div>
      )}
    </div>
  );
}
