import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalysisMetrics from '../components/projects/AnalysisMetrics';
import DependencyGraph from '../components/projects/DependencyGraph';
import FindingsPanel from '../components/projects/FindingsPanel';
import ScenarioScorecard from '../components/projects/ScenarioScorecard';
import AppLayout from '../components/layout/AppLayout';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { AlertTriangle, Sparkles, ArrowRight, GitBranch, RefreshCw } from 'lucide-react';

export default function AnalysisPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const token = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any>(null);

  const [metrics, setMetrics] = useState<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });

  // Phase 4 Intelligence State
  const [findings, setFindings] = useState<any[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);

  // Phase 5 Decomposition State
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [activeScenario, setActiveScenario] = useState<any>(null);
  const [isDecomposing, setIsDecomposing] = useState(false);

  useEffect(() => {
    let findingsPollTimeout: ReturnType<typeof setTimeout>;
    let scenariosPollTimeout: ReturnType<typeof setTimeout>;

    const fetchFindings = async (sourceVersionId: string, isPolling = false) => {
      try {
        const res = await api.get(`/api/projects/${projectId}/intelligence/${sourceVersionId}/findings`);
        if (res.data.success && res.data.data) {
          const parsedFindings = res.data.data.map((f: any) => ({
            ...f,
            subject_ids: typeof f.subject_ids === 'string' ? JSON.parse(f.subject_ids) : f.subject_ids,
            evidence_ids: typeof f.evidence_ids === 'string' ? JSON.parse(f.evidence_ids) : f.evidence_ids,
          }));

          setFindings(parsedFindings);

          if (parsedFindings.length > 0) {
            setIsEnriching(false);
          } else if (isPolling) {
            findingsPollTimeout = setTimeout(() => fetchFindings(sourceVersionId, true), 3000);
          }
        }
      } catch (err) {
        console.error("Failed to fetch findings", err);
        setIsEnriching(false);
      }
    };

    const fetchScenarios = async (isPolling = false) => {
      try {
        const res = await api.get(`/api/projects/${projectId}/scenarios`);
        if (res.data.success && res.data.data) {
          setScenarios(res.data.data);

          const generating = res.data.data.some((s: any) => s.status === 'generating');
          setIsDecomposing(generating);

          if (generating && isPolling) {
            scenariosPollTimeout = setTimeout(() => fetchScenarios(true), 3000);
          }
        }
      } catch (err) {
        console.error("Failed to fetch scenarios", err);
        setIsDecomposing(false);
      }
    };

    const fetchLatestAnalysis = async () => {
      try {
        if (!activeJob) setLoading(true);
        const { createClient } = await import('@supabase/supabase-js');

        const authSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: jobs, error: jobError } = await authSupabase
          .from('analysis_jobs')
          .select('id, source_version_id, status, error_code')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (jobError) throw jobError;

        if (!jobs || jobs.length === 0) {
          setError("No ingestion job found for this project.");
          setLoading(false);
          return;
        }

        const latestJob = jobs[0];
        setActiveJob(latestJob);

        if (latestJob.status !== 'completed') {
          setLoading(false);
          return;
        }

        // Fetch metrics & graph
        const [metricsRes, graphRes] = await Promise.all([
          api.get(`/api/projects/${projectId}/analysis`),
          api.get(`/api/projects/${projectId}/analysis/graph?source_version_id=${latestJob.source_version_id}`)
        ]);

        if (metricsRes.data.success) {
          setMetrics(metricsRes.data.data);
        }

        if (graphRes.data.success) {
          setGraphData(graphRes.data.data);
        }

        // Fetch Intelligence & Scenarios
        fetchFindings(latestJob.source_version_id, true);
        fetchScenarios(true);

      } catch (err: any) {
        console.error("Analysis load error:", err);
        setError(err.response?.data?.error || err.message || "Failed to load analysis.");
      } finally {
        setLoading(false);
      }
    };

    if (projectId && token) {
      fetchLatestAnalysis();
    }

    return () => {
      clearTimeout(findingsPollTimeout);
      clearTimeout(scenariosPollTimeout);
    };
  }, [projectId, token]);

  const loadScenarioDetails = async (scenarioId: string) => {
    try {
      const res = await api.get(`/api/projects/${projectId}/scenarios/${scenarioId}`);
      if (res.data.success && res.data.data) {
        setActiveScenario(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load scenario details", err);
    }
  };

  const handleTriggerEnrichment = async () => {
    if (!activeJob?.source_version_id) return;
    try {
      setIsEnriching(true);
      await api.post(`/api/projects/${projectId}/intelligence/enrich`, {
        source_version_id: activeJob.source_version_id
      });
    } catch (err) {
      console.error("Failed to trigger enrichment", err);
      setIsEnriching(false);
    }
  };

  const handleTriggerDecomposition = async (strategyType: string) => {
    if (!activeJob?.source_version_id) return;
    try {
      setIsDecomposing(true);
      const res = await api.post(`/api/projects/${projectId}/scenarios`, {
        source_version_id: activeJob.source_version_id,
        strategy_type: strategyType
      });

      if (res.data.success) {
        const newScenario = res.data.data;
        setScenarios(prev => [newScenario, ...prev]);
        setActiveScenario(newScenario);
      }
    } catch (err) {
      console.error("Failed to trigger decomposition", err);
      setIsDecomposing(false);
    }
  };

  const handleReviewFinding = async (findingId: string, status: string) => {
    try {
      const res = await api.patch(`/api/projects/${projectId}/intelligence/findings/${findingId}`, {
        review_status: status
      });

      if (res.data.success) {
        setFindings(prev => prev.map(f => f.id === findingId ? { ...f, review_status: status } : f));
      }
    } catch (err) {
      console.error("Failed to update finding status", err);
    }
  };

  return (
    <AppLayout title="Code Analysis">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-lime-400" />
            AST DECOMPOSITION ENGINE
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Parsing dependency graphs, bounded contexts, and service boundaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/dashboard/projects/${projectId}/plans`)}
            className="px-5 py-2.5 rounded-full text-xs font-extrabold bg-lime-400 hover:bg-lime-300 text-black shadow-lg flex items-center gap-2 transition-all hover:scale-105"
          >
            VIEW MIGRATION ROADMAP <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#141417] border border-[#232328] rounded-3xl p-12 text-center text-zinc-400 font-mono text-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-lime-400 mx-auto mb-3" />
          Parsing AST Nodes and Dependency Graphs...
        </div>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-900/60 p-5 rounded-2xl text-rose-300 text-sm flex items-center gap-3 font-mono">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Phase 3 Code Metrics */}
          {metrics && <AnalysisMetrics metrics={metrics} />}

          {/* Action Toolbar (Strategy Selector Pills matching screenshot style) */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-syne text-zinc-400 uppercase mr-2">
                DECOMPOSITION STRATEGY:
              </span>
              <button
                onClick={() => handleTriggerDecomposition('domain')}
                disabled={isDecomposing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#1e1e24] hover:bg-lime-400 hover:text-black text-zinc-200 border border-[#2e2e38] transition-all disabled:opacity-50"
              >
                Domain-Driven
              </button>
              <button
                onClick={() => handleTriggerDecomposition('team')}
                disabled={isDecomposing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#1e1e24] hover:bg-purple-400 hover:text-black text-zinc-200 border border-[#2e2e38] transition-all disabled:opacity-50"
              >
                Team-Aligned
              </button>
              <button
                onClick={() => handleTriggerDecomposition('conservative')}
                disabled={isDecomposing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#1e1e24] hover:bg-indigo-400 hover:text-black text-zinc-200 border border-[#2e2e38] transition-all disabled:opacity-50"
              >
                Conservative
              </button>
              <button
                onClick={() => handleTriggerDecomposition('aggressive')}
                disabled={isDecomposing}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#1e1e24] hover:bg-orange-500 hover:text-white text-zinc-200 border border-[#2e2e38] transition-all disabled:opacity-50"
              >
                Aggressive
              </button>
            </div>

            <button
              onClick={handleTriggerEnrichment}
              disabled={isEnriching}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#1c1c22] hover:bg-zinc-800 text-zinc-300 border border-[#2c2c36] flex items-center gap-2 transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 text-lime-400 ${isEnriching ? 'animate-spin' : ''}`} />
              {isEnriching ? 'Enriching...' : 'Run LLM Intelligence'}
            </button>
          </div>

          {/* Scenarios Selector Tabs */}
          {scenarios.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 font-mono text-xs">
              <span className="text-zinc-500 font-bold uppercase">Scenarios:</span>
              {scenarios.map(scen => (
                <button
                  key={scen.id}
                  onClick={() => loadScenarioDetails(scen.id)}
                  className={`px-4 py-1.5 rounded-full border transition-all font-bold uppercase ${
                    activeScenario?.id === scen.id
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-[#141417] text-zinc-400 border-[#232328] hover:text-zinc-200'
                  }`}
                >
                  {scen.strategy_type} {scen.status === 'generating' && '(Running...)'}
                </button>
              ))}
            </div>
          )}

          {/* Phase 5 Scenario Scorecard */}
          {activeScenario && (
            <ScenarioScorecard
              scenario={activeScenario}
              revisions={activeScenario.revisions}
              proposedServices={activeScenario.proposed_services}
            />
          )}

          {/* Phase 4 AI Findings */}
          {findings.length > 0 && (
            <FindingsPanel findings={findings} onReview={handleReviewFinding} />
          )}

          {/* Dependency Graph Container (Reference Card Style) */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-4 shadow-2xl relative min-h-[600px] overflow-hidden">
            {activeScenario && activeScenario.proposed_services && activeScenario.proposed_services.length > 0 && (
              <div className="absolute top-6 right-6 z-10 px-4 py-1.5 bg-lime-400 text-black font-extrabold font-mono text-xs uppercase rounded-full shadow-lg">
                Active Boundaries: {activeScenario.strategy_type}
              </div>
            )}
            <DependencyGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              proposedServices={activeScenario?.proposed_services}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
