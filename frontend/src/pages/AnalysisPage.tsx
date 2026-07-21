/* Analysis responses are heterogeneous backend JSON payloads. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
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

    let pollCount = 0;
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
          } else if (isPolling && pollCount < 10) {
            pollCount++;
            findingsPollTimeout = setTimeout(() => fetchFindings(sourceVersionId, true), 3000);
          } else {
            setIsEnriching(false);
          }
        } else {
          setIsEnriching(false);
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

        if (jobs && jobs.length > 0) {
          const latestJob = jobs[0];
          setActiveJob(latestJob);

          if (latestJob.status === 'completed' && latestJob.source_version_id) {
            const [metricsRes, graphRes] = await Promise.allSettled([
              api.get(`/api/projects/${projectId}/analysis/${latestJob.source_version_id}/metrics`),
              api.get(`/api/projects/${projectId}/analysis/${latestJob.source_version_id}/graph`)
            ]);

            if (metricsRes.status === 'fulfilled' && metricsRes.value.data) {
              const data = metricsRes.value.data.data?.data || metricsRes.value.data.data || metricsRes.value.data;
              setMetrics(data);
            }
            if (graphRes.status === 'fulfilled' && graphRes.value.data) {
              const data = graphRes.value.data.data?.data || graphRes.value.data.data || graphRes.value.data;
              setGraphData(data);
            }

            fetchFindings(latestJob.source_version_id);
            fetchScenarios();
          } else if (latestJob.status === 'failed') {
            setError(`Analysis Job Failed: ${latestJob.error_code || 'Unknown error'}`);
          }
        } else {
          setError('No analysis job found for this project.');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch analysis data');
      } finally {
        setLoading(false);
      }
    };

    fetchLatestAnalysis();

    return () => {
      clearTimeout(findingsPollTimeout);
      clearTimeout(scenariosPollTimeout);
    };
  }, [projectId, token]);

  const loadScenarioDetails = async (scenarioId: string) => {
    try {
      const res = await api.get(`/api/projects/${projectId}/scenarios/${scenarioId}`);
      if (res.data.success) {
        setActiveScenario(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch scenario details", err);
    }
  };

  const handleTriggerEnrichment = async () => {
    if (!activeJob?.source_version_id) return;
    try {
      setIsEnriching(true);
      await api.post(`/api/projects/${projectId}/intelligence/trigger`, { sourceVersionId: activeJob.source_version_id });
      setTimeout(() => {
        setIsEnriching(false);
      }, 5000);
    } catch (err) {
      console.error("Failed to trigger LLM enrichment", err);
      setIsEnriching(false);
    }
  };

  const handleTriggerDecomposition = async (strategy: string) => {
    if (!activeJob?.source_version_id) return;
    try {
      setIsDecomposing(true);
      const res = await api.post(`/api/projects/${projectId}/scenarios/generate`, {
        sourceVersionId: activeJob.source_version_id,
        strategyType: strategy
      });

      if (res.data.success && res.data.data?.id) {
        loadScenarioDetails(res.data.data.id);
      }
    } catch (err) {
      console.error("Failed to trigger decomposition", err);
      setIsDecomposing(false);
    }
  };

  const handleReviewFinding = async (findingId: string, status: string) => {
    try {
      const res = await api.patch(`/api/projects/${projectId}/intelligence/findings/${findingId}/review`, { status });

      if (res.data.success) {
        setFindings(prev => prev.map(f => f.id === findingId ? { ...f, review_status: status } : f));
      }
    } catch (err) {
      console.error("Failed to update finding status", err);
    }
  };

  return (
    <AppLayout>
      {/* Top Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bebas text-4xl sm:text-5xl text-white tracking-wide flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-[#B8FF45]" />
            AST DECOMPOSITION ENGINE
          </h1>
          <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
            Parsing dependency graphs, bounded contexts, and microservices candidate boundaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/app/projects/${projectId}/plans`)}
            className="neo-btn-primary flex items-center gap-2 hover:scale-105"
          >
            VIEW MIGRATION ROADMAP <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="neo-card p-12 text-center text-[#BEBEBE] text-sm font-medium">
          <RefreshCw className="w-8 h-8 animate-spin text-[#B8FF45] mx-auto mb-3" />
          Parsing AST Nodes and Dependency Graphs...
        </div>
      )}

      {error && (
        <div className="bg-[#FF5A5F]/10 border border-[#FF5A5F]/20 p-5 rounded-[18px] text-[#FF5A5F] text-sm flex items-center gap-3 font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Phase 3 Code Metrics */}
          {metrics && <AnalysisMetrics metrics={metrics} />}

          {/* Strategy Selector Pills */}
          <div className="neo-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bebas text-lg text-[#BEBEBE] mr-2">
                DECOMPOSITION STRATEGY:
              </span>
              <button
                onClick={() => handleTriggerDecomposition('domain')}
                disabled={isDecomposing}
                className="neo-btn hover:bg-[#B8FF45] hover:text-black transition-all text-xs disabled:opacity-50"
              >
                Domain-Driven
              </button>
              <button
                onClick={() => handleTriggerDecomposition('team')}
                disabled={isDecomposing}
                className="neo-btn hover:bg-[#FF5BB5] hover:text-black transition-all text-xs disabled:opacity-50"
              >
                Team-Aligned
              </button>
              <button
                onClick={() => handleTriggerDecomposition('conservative')}
                disabled={isDecomposing}
                className="neo-btn hover:bg-[#3B82F6] hover:text-white transition-all text-xs disabled:opacity-50"
              >
                Conservative
              </button>
              <button
                onClick={() => handleTriggerDecomposition('aggressive')}
                disabled={isDecomposing}
                className="neo-btn hover:bg-[#FFA62B] hover:text-black transition-all text-xs disabled:opacity-50"
              >
                Aggressive
              </button>
            </div>

            <button
              onClick={handleTriggerEnrichment}
              disabled={isEnriching}
              className="neo-btn flex items-center gap-2 text-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#B8FF45] ${isEnriching ? 'animate-spin' : ''}`} />
              {isEnriching ? 'Enriching...' : 'Run LLM Intelligence'}
            </button>
          </div>

          {/* Scenarios Selector Tabs */}
          {scenarios.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-semibold">
              <span className="text-[#808080] uppercase">Scenarios:</span>
              {scenarios.map(scen => (
                <button
                  key={scen.id}
                  onClick={() => loadScenarioDetails(scen.id)}
                  className={`px-4 py-2 rounded-full transition-all uppercase ${
                    activeScenario?.id === scen.id
                      ? 'bg-[#B8FF45] text-black font-bold shadow'
                      : 'bg-[#181818] text-[#BEBEBE] hover:bg-[#252525]'
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
              proposedServices={activeScenario.proposed_services}
            />
          )}

          {/* Phase 4 AI Findings */}
          {findings.length > 0 && (
            <FindingsPanel findings={findings} onReview={handleReviewFinding} />
          )}

          {/* Dependency Graph Container */}
          <div className="neo-card p-4 relative min-h-[600px] overflow-hidden">
            {activeScenario && activeScenario.proposed_services && activeScenario.proposed_services.length > 0 && (
              <div className="absolute top-6 right-6 z-10 px-4 py-2 bg-[#B8FF45] text-black font-bold font-bebas text-sm uppercase rounded-full shadow">
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
