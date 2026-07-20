import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalysisMetrics from '../components/projects/AnalysisMetrics';
import DependencyGraph from '../components/projects/DependencyGraph';
import FindingsPanel from '../components/projects/FindingsPanel';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

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

  useEffect(() => {
    let pollTimeout: ReturnType<typeof setTimeout>;
    let findingsPollTimeout: ReturnType<typeof setTimeout>;

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
          if (latestJob.status === 'ready') {
            try {
              await api.post(`/api/projects/${projectId}/analysis/trigger`, { source_version_id: latestJob.source_version_id });
            } catch (e) {
              console.error("Failed to trigger AI analysis", e);
            }
          }
          
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
          setMetrics(metricsRes.data);
          setGraphData({ nodes: graphRes.data.nodes || [], edges: graphRes.data.edges || [] });
        } catch (e) {
          console.error("Failed to fetch analysis data", e);
        }

        // Check if we already have intelligence findings
        await fetchFindings(latestJob.source_version_id, false);

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
    };
  }, [projectId, token]);

  const handleRunIntelligence = async () => {
    if (!activeJob) return;
    setIsEnriching(true);
    try {
      await api.post(`/api/projects/${projectId}/intelligence/trigger`, {
        source_version_id: activeJob.source_version_id
      });
      
      // Start polling for results
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
        } catch(err) {
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
      // Update local state immediately
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, review_status: status, needs_review: false } : f));
    } catch (e) {
      console.error("Failed to review finding", e);
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
      <div className="p-8 font-mono bg-[#0a0a0a] min-h-screen text-white">
        <div className="bg-[#111] border border-red-900 p-6">
          <h2 className="text-red-500 font-bold mb-2">Analysis Error</h2>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={() => navigate(`/app/projects/${projectId}`)}
            className="mt-4 px-4 py-2 bg-white text-black font-bold text-sm uppercase"
          >
            Go Back
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

      <div className="w-full flex-1 bg-[#111] p-1 border border-[#222]">
        <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
      </div>
    </div>
  );
}
