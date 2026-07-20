import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalysisMetrics from '../components/projects/AnalysisMetrics';
import DependencyGraph from '../components/projects/DependencyGraph';
import { useAuthStore } from '../stores/authStore';

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

  // On mount, we need to find the latest job or run for this project.
  // The backend doesn't have an endpoint to "get latest run for project" easily, 
  // but we can query the /projects/:id/sources or assume the user just triggered an upload
  // For the hackathon, let's assume we can query Supabase directly or there's an API route.
  
  // Actually, we can fetch all jobs for the project using Supabase client to find the latest source_version_id
  useEffect(() => {
    const fetchLatestAnalysis = async () => {
      try {
        setLoading(true);
        // 1. Fetch project details and latest jobs via API
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );
        
        // Use RLS with the user's token
        const authSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        // Fetch latest completed analysis job
        const { data: jobs, error: jobError } = await authSupabase
          .from('analysis_jobs')
          .select('id, source_version_id, status')
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

        if (latestJob.status !== 'completed') {
          // It's still processing! We should poll.
          // For simplicity, just show processing state.
          setLoading(false);
          return;
        }

        // It is completed. Fetch the metrics and graph from the API Gateway
        const headers = { Authorization: `Bearer ${token}` };
        
        // Fetch Metrics
        const metricsRes = await fetch(`http://localhost:4000/api/projects/${projectId}/analysis/${latestJob.source_version_id}/metrics`, { headers });
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }

        // Fetch Graph
        const graphRes = await fetch(`http://localhost:4000/api/projects/${projectId}/analysis/${latestJob.source_version_id}/graph?depth=2&limit=500`, { headers });
        if (graphRes.ok) {
          const graphData = await graphRes.json();
          setGraphData({ nodes: graphData.nodes || [], edges: graphData.edges || [] });
        }

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
  }, [projectId, token]);


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
        <button 
          onClick={() => navigate(`/app/projects/${projectId}`)}
          className="px-4 py-2 border border-[#222] text-gray-400 font-bold text-xs uppercase hover:text-white hover:bg-[#111]"
        >
          Back to Project
        </button>
      </div>

      <AnalysisMetrics metrics={metrics} />

      <div className="w-full flex-1 bg-[#111] p-1 border border-[#222]">
        <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
      </div>
    </div>
  );
}
