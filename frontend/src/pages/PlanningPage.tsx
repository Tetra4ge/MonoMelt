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

  return (
    <AppLayout title="Migration Roadmap">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-lime-400" />
            MIGRATION ROADMAP ENGINE
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Actionable rollout timeline, zero-trust consistency rules, cost simulation, and team mapping
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeRevision && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-4 py-2.5 rounded-full text-xs font-extrabold bg-[#1a1a20] hover:bg-zinc-800 text-zinc-200 border border-[#2a2a34] flex items-center gap-2 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4 text-lime-400" />
              Adjust Assumptions
            </button>
          )}

          <button
            onClick={handleCreatePlan}
            disabled={isGenerating}
            className="px-5 py-2.5 rounded-full text-xs font-extrabold bg-lime-400 hover:bg-lime-300 text-black shadow-lg flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
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
        <div className="bg-[#141417] border border-[#232328] rounded-3xl p-12 text-center text-zinc-400 font-mono text-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-lime-400 mx-auto mb-3" />
          Loading Migration Strategy & Risk Models...
        </div>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/60 p-5 rounded-2xl text-rose-300 text-sm flex items-center gap-3 font-mono">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {!activeRevision ? (
            <div className="bg-[#141417] border border-[#232328] rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-2xl">
              <div className="w-16 h-16 bg-[#1b1b22] border border-[#2b2b36] text-lime-400 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold font-syne text-white uppercase tracking-wide">
                No Migration Plan Generated Yet
              </h3>
              <p className="text-xs font-mono text-zinc-400">
                Generate an actionable migration strategy from your completed microservice decomposition scenario.
              </p>
              <button
                onClick={handleCreatePlan}
                disabled={isGenerating}
                className="px-6 py-3 rounded-full text-xs font-extrabold bg-lime-400 hover:bg-lime-300 text-black shadow-lg inline-flex items-center gap-2 transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Generate Migration Plan
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Revision Selector Bar */}
              {activePlan?.plan_revisions && activePlan.plan_revisions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 font-mono text-xs">
                  <span className="text-zinc-500 font-bold uppercase">Revisions:</span>
                  {activePlan.plan_revisions.map((rev: any) => (
                    <button
                      key={rev.id}
                      onClick={() => setActiveRevision(rev)}
                      className={`px-4 py-1.5 rounded-full border font-bold uppercase transition-all ${
                        activeRevision?.id === rev.id
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-[#141417] text-zinc-400 border-[#232328] hover:text-zinc-200'
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
