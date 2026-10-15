import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PlanSetup from '../components/planning/PlanSetup';
import RoadmapTimeline from '../components/planning/RoadmapTimeline';
import CostPerformancePanel from '../components/planning/CostPerformancePanel';
import ConsistencyMatrix from '../components/planning/ConsistencyMatrix';
import TeamOwnershipPanel from '../components/planning/TeamOwnershipPanel';
import PlanRevisionHistory from '../components/planning/PlanRevisionHistory';
import { createPlan, getLatestReport, getPlan, listPlans, recalculatePlan } from '../features/planning/planning.api';
import type { MigrationPlan, PlanAssumptions, PlanRevision } from '../features/planning/types';

const defaultAssumptions: PlanAssumptions = { cloud_provider: 'aws', pricing_region: 'us-east-1', cost_multiplier: 1, team_count: 3, risk_tolerance: 'medium', migration_window_months: 6 };

export default function PlanningPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MigrationPlan[]>([]);
  const [activePlan, setActivePlan] = useState<MigrationPlan | null>(null);
  const [activeRevision, setActiveRevision] = useState<PlanRevision | null>(null);
  const [assumptions, setAssumptions] = useState<PlanAssumptions>(defaultAssumptions);
  const [scenarioId, setScenarioId] = useState<string>(() => (() => { const q = new URLSearchParams(window.location.search); return q.get('scenarioId') ?? q.get('scenarioRevisionId') ?? ''; })());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = async (plan: MigrationPlan) => {
    if (!projectId) return;
    const detail = await getPlan(projectId, plan.id);
    const revision = detail.latest_revision ?? detail.revisions?.[0] ?? null;
    setActivePlan(detail);
    setActiveRevision(revision);
    if (revision) setAssumptions(revision.assumptions);
  };

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    listPlans(projectId).then(async result => {
      if (cancelled) return;
      setPlans(result);
      if (result[0]) await loadPlan(result[0]);
      setLoading(false);
    }).catch(() => { if (!cancelled) { setError('Unable to load migration plans.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId]);

  const report = useMemo(() => activeRevision ? getLatestReport({ ...activePlan, latest_revision: activeRevision } as MigrationPlan) : null, [activePlan, activeRevision]);

  const handleGenerate = async () => {
    if (!projectId || !scenarioId) { setError('Select a completed scenario before generating a plan.'); return; }
    setSaving(true); setError(null);
    try {
      const plan = await createPlan(projectId, scenarioId, assumptions);
      setPlans(current => [plan, ...current.filter(item => item.id !== plan.id)]);
      await loadPlan(plan);
    } catch { setError('Plan generation failed. Check the selected scenario and try again.'); } finally { setSaving(false); }
  };

  const handleRecalculate = async () => {
    if (!projectId || !activePlan) return;
    setSaving(true); setError(null);
    try { const plan = await recalculatePlan(projectId, activePlan.id, assumptions); setPlans(current => current.map(item => item.id === plan.id ? plan : item)); await loadPlan(plan); }
    catch { setError('Recalculation failed. Your current report revision is unchanged.'); } finally { setSaving(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] font-mono text-xs text-gray-500">[ loading planning workspace ]</main>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-gray-300 sm:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs uppercase tracking-[0.2em] text-gray-600">monomelt / transformation_intelligence</p><h1 className="mt-2 text-2xl font-bold text-white">&gt; migration_planning</h1><p className="mt-2 text-xs text-gray-500">Convert a selected decomposition scenario into an evidence-backed execution plan.</p></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(`/dashboard/projects/${projectId}/twin`)} className="border border-[#222] bg-[#111] px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:border-white hover:text-white">Observatory</button>
            <button type="button" onClick={() => navigate(`/dashboard/projects/${projectId}/analysis`)} className="border border-[#222] bg-[#111] px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:border-white hover:text-white">Back to analysis</button>
          </div>
        </header>

        {error && <div className="mb-5 border border-[#555] bg-[#111] p-4 text-xs text-gray-300">error: {error}</div>}

        {!activePlan && <div className="mb-6"><div className="mb-4 border border-[#222] bg-[#111] p-4"><p className="mb-3 text-xs text-gray-500">existing plans: {plans.length}</p><label className="text-xs text-gray-400">Scenario ID<input value={scenarioId} onChange={event => setScenarioId(event.target.value)} placeholder="Paste completed scenario ID" className="mt-2 w-full border border-[#222] bg-[#0a0a0a] px-3 py-3 text-xs text-white outline-none focus:border-white" /></label></div><PlanSetup assumptions={assumptions} disabled={saving} submitLabel={saving ? 'Generating...' : 'Generate migration plan'} onChange={setAssumptions} onSubmit={handleGenerate} /></div>}

        {activePlan && report && activeRevision && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[240px_1fr]">
            <PlanRevisionHistory revisions={activePlan.revisions ?? [activeRevision]} activeRevisionId={activeRevision.id} onSelect={revision => { setActiveRevision(revision); setAssumptions(revision.assumptions); }} />
            <div className="space-y-6">
              <div className="border border-[#222] bg-[#111] p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-gray-500">plan_{activePlan.id.slice(0, 8)}</p><h2 className="mt-2 text-lg font-bold text-white">{activePlan.title}</h2><p className="mt-2 text-xs text-gray-500">revision {activeRevision.revision_number} / generated {new Date(activeRevision.created_at).toLocaleString()}</p></div><div className="text-xs text-gray-400">status: <span className="text-white">{activePlan.status}</span></div></div></div>
              <PlanSetup assumptions={assumptions} disabled={saving} submitLabel={saving ? 'Recalculating...' : 'Recalculate report'} onChange={setAssumptions} onSubmit={handleRecalculate} />
              <RoadmapTimeline roadmap={report.roadmap} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><CostPerformancePanel data={report.cost_performance} /><TeamOwnershipPanel mapping={report.team_mapping} /></div>
              <ConsistencyMatrix matrix={report.consistency_security} />
              
              {/* CTA */}
              <div className="mt-12 flex justify-end">
                <button
                  onClick={() => navigate(`/dashboard/projects/${projectId}/export?planId=${activePlan.id}`)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 font-bold uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  Proceed to Generation &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
