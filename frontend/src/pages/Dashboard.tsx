import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { LogOut, FolderGit2, Activity, Terminal, ChevronRight} from 'lucide-react';
import { UploadSource } from '../components/projects/UploadSource';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [health, setHealth] = useState<{ gateway: string; ai: string; neo4j: string; postgres: string; redis: string }>({ gateway: 'checking', ai: 'checking', neo4j: 'checking', postgres: 'checking', redis: 'checking' });

  const handleSignOut = async () => {
    navigate('/');
    await signOut();
  };

  useEffect(() => {
    // Real service status from the gateway's aggregated /health.
    api.get('/health')
      .then(res => setHealth({
        gateway: 'up',
        ai: res.data.services?.['ai-service'] ?? 'down',
        neo4j: res.data.services?.neo4j ?? 'unknown',
        postgres: res.data.services?.postgres ?? 'unknown',
        redis: res.data.services?.redis ?? 'unknown',
      }))
      .catch(() => setHealth({ gateway: 'down', ai: 'unknown', neo4j: 'unknown', postgres: 'unknown', redis: 'unknown' }));
  }, []);

  useEffect(() => {
    const fetchRecentProjects = async () => {
      try {
        setLoadingProjects(true);
        // 1. Fetch all projects
        const res = await api.get('/api/projects');
        if (res.data.success && res.data.data) {
          const projects = res.data.data;
          
          // 2. Fetch latest analysis job for each project to determine status
          const enrichedProjects = await Promise.all(projects.map(async (p: any) => {
            const { data: jobs } = await supabase
              .from('analysis_jobs')
              .select('status')
              .eq('project_id', p.id)
              .order('created_at', { ascending: false })
              .limit(1);
              
            let statusText = 'Pending Ingestion';
            let statusColor = 'text-gray-500';
            
            if (jobs && jobs.length > 0) {
              const jobStatus = jobs[0].status;
              if (jobStatus === 'completed') {
                statusText = 'AST Parsed / Analysis Ready';
                statusColor = 'text-blue-400';
              } else if (jobStatus === 'failed') {
                statusText = 'Ingestion Failed';
                statusColor = 'text-red-500';
              } else {
                statusText = 'Parsing in Progress...';
                statusColor = 'text-yellow-500';
              }
            }
            
            return { ...p, displayStatus: statusText, statusColor };
          }));
          
          // Sort newest first
          enrichedProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setRecentProjects(enrichedProjects);
        }
      } catch (e) {
        console.error('Failed to fetch recent projects', e);
      } finally {
        setLoadingProjects(false);
      }
    };
    
    fetchRecentProjects();
  }, []);

  const handleInitializeProject = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/projects', { 
        name: `Workspace_${Math.floor(Math.random() * 10000)}`, 
        description: 'Generated from dashboard',
        source_type: 'github'
      });
      setProjectId(res.data.data.id);
    } catch (e) {
      console.error('Failed to create project', e);
    } finally {
      setLoading(false);
    }
  };

  const handleJobStarted = () => {
    navigate(`/dashboard/projects/${projectId}/analysis`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-[#222] pb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-white shrink-0" />
            <Link to="/">
              <h1 className="text-2xl sm:text-3xl font-logo tracking-widest text-gray-200 hover:text-white transition-colors cursor-pointer">monomelt</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <Link 
              to="/"
              className="text-gray-400 hover:text-white transition-colors text-sm font-bold hidden sm:block"
            >
              HOME
            </Link>
            <Link 
              to="/dashboard/projects/sandbox/twin"
              className="text-gray-400 hover:text-white transition-colors text-sm font-bold hidden sm:block"
            >
              OBSERVATORY
            </Link>
            <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
              <span className="text-gray-400">user:</span>
              <span>{user?.user_metadata?.user_name || user?.email}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#111] hover:bg-[#222] px-4 py-2 rounded-sm border border-[#222] text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              EXIT
            </button>
          </div>
        </header>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Action Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">&gt; ingest_repository</h2>
              <p className="text-gray-500 mb-6 text-xs">Target a GitHub repository for AST parsing and modular extraction.</p>
              
              {!projectId ? (
                <div 
                  onClick={handleInitializeProject}
                  className="border border-dashed border-[#444] bg-[#0a0a0a] rounded-sm p-12 text-center hover:bg-[#151515] hover:border-blue-500 transition-colors cursor-pointer group"
                >
                  <FolderGit2 className="w-10 h-10 text-gray-500 group-hover:text-blue-400 mx-auto mb-4 transition-colors" />
                  <h3 className="text-sm font-bold text-gray-300 group-hover:text-white uppercase tracking-wide">Initialize New Project Workspace</h3>
                  <p className="text-xs text-gray-600 mt-2">{loading ? 'Creating...' : 'Click to begin ingestion flow'}</p>
                </div>
              ) : (
                <UploadSource projectId={projectId} onJobStarted={handleJobStarted} />
              )}
            </div>

            {/* Recent Workspaces */}
            <div className="bg-[#111] border border-[#222] rounded-sm p-8 shadow-xl">
               <h2 className="text-xl font-bold text-white mb-2">&gt; recent_workspaces</h2>
               <p className="text-gray-500 mb-6 text-xs">Resume analysis and microservice decomposition.</p>
               
               {loadingProjects ? (
                 <div className="text-center p-8 text-gray-500 text-xs animate-pulse">Loading workspaces...</div>
               ) : recentProjects.length === 0 ? (
                 <div className="text-center p-8 border border-dashed border-[#333] text-gray-600 text-xs">No recent workspaces found.</div>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {recentProjects.map(project => (
                     <div 
                       key={project.id}
                       onClick={() => navigate(`/dashboard/projects/${project.id}/analysis`)}
                       className="border border-[#333] bg-[#0a0a0a] p-4 cursor-pointer hover:border-blue-500 hover:bg-[#151515] transition-all group relative overflow-hidden"
                     >
                       <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ChevronRight className="w-5 h-5 text-blue-500" />
                       </div>
                       <h3 className="font-bold text-white text-sm mb-1 truncate pr-6">{project.name}</h3>
                       <p className="text-[10px] text-gray-500 mb-3">
                         Created: {new Date(project.created_at).toLocaleDateString()}
                       </p>
                       <div className="flex items-center justify-between gap-2">
                         <div className="inline-flex items-center gap-1.5 bg-[#111] border border-[#222] px-2 py-1 rounded">
                           <div className={`w-1.5 h-1.5 rounded-full ${project.statusColor.replace('text-', 'bg-')}`}></div>
                           <span className={`text-[9px] uppercase tracking-wider font-bold ${project.statusColor}`}>
                             {project.displayStatus}
                           </span>
                         </div>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             navigate(`/dashboard/projects/${project.id}/twin`);
                           }}
                           className="text-[9px] border border-[#333] hover:border-white px-2 py-1 text-gray-400 hover:text-white uppercase transition-colors"
                         >
                           TWIN
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-6">
            <div className="bg-[#111] border border-[#222] rounded-sm p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6 text-white">
                <Activity className="w-4 h-4" />
                <h3 className="font-bold text-sm tracking-wide">SYSTEM_STATUS</h3>
              </div>
              <div className="space-y-4 font-mono text-xs">
                {([
                  ['api-gateway', health.gateway],
                  ['ai-service', health.ai],
                  ['neo4j_graph', health.neo4j],
                  ['postgres', health.postgres],
                  ['redis_queue', health.redis],
                ] as const).map(([name, state]) => {
                  const ok = state === 'up' || state === 'connected';
                  const pending = state === 'checking' || state === 'unknown';
                  return (
                    <div key={name} className="flex justify-between items-center border-b border-[#222] pb-2">
                      <span className="text-gray-500">{name}</span>
                      <span className={`font-bold uppercase ${ok ? 'text-emerald-500' : pending ? 'text-gray-600' : 'text-red-500'}`}>
                        {ok ? 'ONLINE' : pending ? state : 'OFFLINE'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-sm p-6 shadow-xl">
              <h3 className="font-bold text-white mb-4 text-sm tracking-wide">EXECUTION_LOG</h3>
              <p className="text-xs text-gray-600 font-mono">No active jobs found in queue.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
