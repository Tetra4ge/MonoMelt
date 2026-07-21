import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import RoadmapTimeline from '../components/planning/RoadmapTimeline';
import ConsistencySecurityMatrix from '../components/planning/ConsistencySecurityMatrix';
import CostPerformanceSimulator from '../components/planning/CostPerformanceSimulator';
import TeamMappingView from '../components/planning/TeamMappingView';
import AssumptionsDrawer from '../components/planning/AssumptionsDrawer';
import AppLayout from '../components/layout/AppLayout';
import api from '../lib/api';
import { 
  Plus, 
  SlidersHorizontal, 
  RefreshCw, 
  AlertCircle, 
  Sparkles,
  Calendar
} from 'lucide-react';

export default function PlanningPage() {
  const { projectId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

      const [scenariosRes, plansRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/scenarios`),
        api.get(`/api/projects/${projectId}/plans`)
      ]);

      if (scenariosRes.data.success) {
        setScenarios(scenariosRes.data.data || []);
      }

      if (plansRes.data.success && plansRes.data.data?.length > 0) {
        const fetchedPlans = plansRes.data.data;

        const latestPlan = fetchedPlans[0];
        setActivePlan(latestPlan);

        const revs = latestPlan.plan_revisions || [];
        const selectedRev = revs.find((r: any) => r.is_selected) || revs[0];
        setActiveRevision(selectedRev);
      }
    } catch (err: any) {
      console.error("Failed to load plans", err);
      setError(err.response?.data?.message || err.message || "Failed to load migration plan");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const completedScenario = scenarios.find(s => s.status === 'completed') || scenarios[0];
      if (!completedScenario) {
        throw new Error("No scenario available to generate migration plan. Run a decomposition strategy first.");
      }

      const res = await api.post(`/api/projects/${projectId}/plans`, {
        scenarioRevisionId: completedScenario.id
      });

      if (res.data.success) {
        await fetchPlansAndScenarios();
      }
    } catch (err: any) {
      console.error("Failed to generate plan", err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecalculate = async (newAssumptions: any) => {
    if (!activePlan?.id) return;
    try {
      setIsGenerating(true);
      const res = await api.post(`/api/projects/${projectId}/plans/${activePlan.id}/recalculate`, {
        assumptions: newAssumptions
      });

      if (res.data.success && res.data.data) {
        setActiveRevision(res.data.data);
      }
    } catch (err: any) {
      console.error("Failed to recalculate plan", err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bebas text-4xl sm:text-5xl text-white tracking-wide flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#B8FF45]" />
            MIGRATION ROADMAP & PLANNING
          </h1>
          <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
            5-Stage Rollout Engine, Saga/Outbox Data Consistency, Cost & Latency Simulator
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeRevision && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="neo-btn flex items-center gap-2 text-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#B8FF45]" />
              Adjust Assumptions
            </button>
          )}

          <button
            onClick={handleCreatePlan}
            disabled={isGenerating}
            className="neo-btn-primary flex items-center gap-2 hover:scale-105 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate New Roadmap
              </>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="neo-card p-12 text-center text-[#BEBEBE] text-sm font-medium">
          <RefreshCw className="w-8 h-8 animate-spin text-[#B8FF45] mx-auto mb-3" />
          Loading Migration Strategy & Risk Models...
        </div>
      )}

      {error && (
        <div className="bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-5 rounded-[18px] text-[#FF5A5F] text-sm flex items-center gap-3 font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {!activeRevision ? (
            <div className="neo-card p-12 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-[#181818] text-[#B8FF45] rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-bebas text-2xl text-white tracking-wide">
                No Migration Plan Generated Yet
              </h3>
              <p className="text-xs text-[#BEBEBE] font-medium">
                Generate an actionable migration strategy from your completed microservice decomposition scenario.
              </p>
              <button
                onClick={handleCreatePlan}
                disabled={isGenerating}
                className="neo-btn-primary inline-flex items-center gap-2 hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Generate Migration Plan
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Revision Selector Bar */}
              {activePlan?.plan_revisions && activePlan.plan_revisions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold">
                  <span className="text-[#808080] uppercase">Revisions:</span>
                  {activePlan.plan_revisions.map((rev: any) => (
                    <button
                      key={rev.id}
                      onClick={() => setActiveRevision(rev)}
                      className={`px-4 py-2 rounded-full uppercase transition-all ${
                        activeRevision?.id === rev.id
                          ? 'bg-[#B8FF45] text-black font-bold shadow'
                          : 'bg-[#181818] text-[#BEBEBE] hover:bg-[#252525]'
                      }`}
                    >
                      Rev #{rev.revision_number} ({new Date(rev.created_at).toLocaleTimeString()})
                    </button>
                  ))}
                </div>
              )}

              {/* Components Breakdown */}
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

              <AssumptionsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                currentAssumptions={activeRevision.assumptions || {}}
                onRecalculate={handleRecalculate}
              />
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
