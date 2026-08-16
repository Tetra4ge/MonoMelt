import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalysisMetrics from '../components/projects/AnalysisMetrics';
import DependencyGraph from '../components/projects/DependencyGraph';
import FindingsPanel from '../components/projects/FindingsPanel';
import ScenarioScorecard from '../components/projects/ScenarioScorecard';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { AlertTriangle } from 'lucide-react';

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
    let pollTimeout: ReturnType<typeof setTimeout>;
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
            setIsEnriching(false); // Done
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
          setError("No analysis found. Upload source code first.");
          setLoading(false);
          return;
        }

        const latestJob = jobs[0];
        setActiveJob(latestJob);

        if (latestJob.status !== 'completed' && latestJob.status !== 'failed') {
          setLoading(false);
          pollTimeout = setTimeout(fetchLatestAnalysis, 3000);
          return;
        }

        if (latestJob.status === 'failed') {
          setError(`Analysis job failed: ${latestJob.error_code || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        // Fetch Metrics & Graph
        try {
          const [metricsRes, graphRes] = await Promise.all([
            api.get(`/api/projects/${projectId}/analysis/${latestJob.source_version_id}/metrics`),
            api.get(`/api/projects/${projectId}/analysis/${latestJob.source_version_id}/graph?depth=2&limit=500`)
          ]);
          setMetrics(metricsRes.data?.data || null);
          setGraphData({ 
            nodes: graphRes.data?.data?.nodes || [], 
            edges: graphRes.data?.data?.edges || [] 
          });
        } catch (e) {
          console.error("Failed to fetch analysis data", e);
        }

        // Check if we already have intelligence findings and scenarios
        await fetchFindings(latestJob.source_version_id, false);
        await fetchScenarios(false);

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching analysis:", err);
        setError(err.message || "Failed to load analysis results");
        setLoading(false);
      }
    };

    if (projectId && token) {
      fetchLatestAnalysis();
    }

    return () => {
      if (pollTimeout) clearTimeout(pollTimeout);
      if (findingsPollTimeout) clearTimeout(findingsPollTimeout);
      if (scenariosPollTimeout) clearTimeout(scenariosPollTimeout);
    };
  }, [projectId, token]);

  const handleRunIntelligence = async () => {
    if (!activeJob) return;
    setIsEnriching(true);
    try {
      await api.post(`/api/projects/${projectId}/intelligence/trigger`, {
        source_version_id: activeJob.source_version_id
      });

      const pollFindings = async () => {
        try {
          const res = await api.get(`/api/projects/${projectId}/intelligence/${activeJob.source_version_id}/findings`);
          if (res.data.success && res.data.data && res.data.data.length > 0) {
            const parsedFindings = res.data.data.map((f: any) => ({
              ...f,
              subject_ids: typeof f.subject_ids === 'string' ? JSON.parse(f.subject_ids) : f.subject_ids,
              evidence_ids: typeof f.evidence_ids === 'string' ? JSON.parse(f.evidence_ids) : f.evidence_ids,
            }));
            setFindings(parsedFindings);
            setIsEnriching(false);
          } else {
            setTimeout(pollFindings, 3000);
          }
        } catch (err) {
          console.error("Poll failed", err);
          setTimeout(pollFindings, 3000);
        }
      };

      pollFindings();
    } catch (e) {
      console.error("Failed to start intelligence", e);
      setIsEnriching(false);
    }
  };

  const handleReviewFinding = async (findingId: string, status: string) => {
    try {
      await api.post(`/api/projects/${projectId}/intelligence/findings/${findingId}/review`, {
        review_status: status
      });
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, review_status: status, needs_review: false } : f));
    } catch (e) {
      console.error("Failed to review finding", e);
    }
  };

  const handleTriggerDecomposition = async (strategy: string) => {
    if (!activeJob) return;
    setIsDecomposing(true);
    try {
      await api.post(`/api/projects/${projectId}/scenarios`, {
        source_version_id: activeJob.source_version_id,
        strategy_type: strategy
      });

      // Start polling scenarios
      const pollScenarios = async () => {
        try {
          const res = await api.get(`/api/projects/${projectId}/scenarios`);
          if (res.data.success) {
            setScenarios(res.data.data);
            const generating = res.data.data.some((s: any) => s.status === 'generating');
            if (generating) {
              setTimeout(pollScenarios, 3000);
            } else {
              setIsDecomposing(false);
            }
          }
        } catch {
          setTimeout(pollScenarios, 3000);
        }
      };

      pollScenarios();
    } catch (e) {
      console.error("Failed to trigger decomposition", e);
      setIsDecomposing(false);
    }
  };

  const loadScenarioDetails = async (scenarioId: string) => {
    try {
      const res = await api.get(`/api/projects/${projectId}/scenarios/${scenarioId}`);
      if (res.data.success) {
        setActiveScenario(res.data.data);
      }
    } catch (e) {
      console.error("Failed to load scenario details", e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 font-mono bg-[#0a0a0a] min-h-screen text-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#222] border-t-white rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400">Loading analysis data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 font-mono bg-[#0a0a0a] min-h-screen text-white flex items-center justify-center">
        <div className="bg-[#111] border border-red-900/50 rounded-md p-8 shadow-2xl max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
          <h2 className="text-xl text-red-500 font-bold mb-3 tracking-wide">Analysis Error</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate(`/dashboard`)}
            className="w-full px-4 py-3 bg-white text-black font-bold text-sm uppercase rounded-sm hover:bg-gray-200 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (activeJob && activeJob.status !== 'completed') {
    return (
      <div className="p-8 font-mono bg-[#0a0a0a] min-h-screen text-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#222] border-t-yellow-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 mb-2">Analysis in progress...</p>
        <p className="text-xs text-gray-600">Status: {activeJob.status}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-4 py-2 border border-[#222] text-white font-bold text-sm uppercase hover:bg-[#111]"
        >
          Refresh Status
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 font-mono bg-[#0a0a0a] min-h-screen text-white">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dependency Graph</h1>
          <p className="text-gray-500 text-sm mt-1">Interactive AST visualization from Neo4j</p>
        </div>
        <div className="flex gap-4 items-center">
          {findings.length === 0 && (
            <button
              onClick={handleRunIntelligence}
              disabled={isEnriching}
              className="px-4 py-2 bg-purple-900/30 text-purple-400 border border-purple-900 font-bold text-xs uppercase hover:bg-purple-900 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isEnriching ? (
                <>
                  <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  Enriching...
                </>
              ) : (
                '✨ Run AI Intelligence'
              )}
            </button>
          )}

          <button
            onClick={() => navigate(`/app/projects/${projectId}`)}
            className="px-4 py-2 border border-[#222] text-gray-400 font-bold text-xs uppercase hover:text-white hover:bg-[#111]"
          >
            Back to Project
          </button>
        </div>
      </div>

      <AnalysisMetrics metrics={metrics} />

      {findings.length > 0 && (
        <FindingsPanel findings={findings} onReview={handleReviewFinding} />
      )}

      {/* Decomposition Engine Section */}
      <div className="mt-8 mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-blue-400">Microservice Decomposition</h2>
          <p className="text-gray-500 text-xs mt-1">Generate proposed boundaries based on the AST using clustering.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleTriggerDecomposition('conservative')}
            disabled={isDecomposing}
            className="px-3 py-2 bg-[#111] border border-[#333] text-gray-300 text-xs font-bold uppercase hover:bg-[#222] hover:text-white disabled:opacity-50"
          >
            Generate Conservative
          </button>
          <button
            onClick={() => handleTriggerDecomposition('aggressive')}
            disabled={isDecomposing}
            className="px-3 py-2 bg-[#111] border border-[#333] text-gray-300 text-xs font-bold uppercase hover:bg-[#222] hover:text-white disabled:opacity-50"
          >
            Generate Aggressive
          </button>
        </div>
      </div>

      {scenarios.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {scenarios.map(scen => (
            <button
              key={scen.id}
              onClick={() => loadScenarioDetails(scen.id)}
              className={`px-4 py-2 border text-xs font-bold uppercase whitespace-nowrap ${activeScenario?.id === scen.id
                  ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                  : 'border-[#333] bg-[#111] text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
            >
              {scen.strategy_type}
              {scen.status === 'generating' && ' (Running...)'}
            </button>
          ))}
        </div>
      )}

      {activeScenario && (
        <div className="flex flex-col gap-4">
          <ScenarioScorecard
            scenario={activeScenario}
            proposedServices={activeScenario.proposed_services}
          />
          <div className="flex justify-end">
            <button
              onClick={() => navigate(`/dashboard/projects/${projectId}/planning?scenarioRevisionId=${activeScenario.id}`)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 font-bold uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              Proceed to Planning&rarr;
            </button>
          </div>
        </div>
      )}

      <div className="w-full flex-1 bg-[#111] p-1 border border-[#222] mt-4 relative">
        {activeScenario && activeScenario.proposed_services && activeScenario.proposed_services.length > 0 && (
          <div className="absolute top-4 right-4 z-10 px-3 py-1 bg-blue-500 text-black font-bold text-xs uppercase animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            Showing {activeScenario.strategy_type} Boundaries
          </div>
        )}
        <DependencyGraph
          nodes={graphData.nodes}
          edges={graphData.edges}
          proposedServices={activeScenario?.proposed_services}
        />
      </div>
    </div>
  );
}
