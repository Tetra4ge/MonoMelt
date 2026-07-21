import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { FolderGit2, Activity, ChevronRight, Plus, Terminal, Sparkles, Server, CheckCircle2 } from 'lucide-react';
import { UploadSource } from '../components/projects/UploadSource';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import AppLayout from '../components/layout/AppLayout';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  const fetchRecentProjects = async () => {
    try {
      setLoadingProjects(true);
      const res = await api.get('/api/projects');
      if (res.data.success && res.data.data) {
        const projects = res.data.data;
        
        const enrichedProjects = await Promise.all(projects.map(async (p: any) => {
          const { data: jobs } = await supabase
            .from('analysis_jobs')
            .select('status')
            .eq('project_id', p.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          let statusText = 'Pending Ingestion';
          let statusDot = 'bg-zinc-500';
          let statusTextClass = 'text-zinc-400';
          
          if (jobs && jobs.length > 0) {
            const jobStatus = jobs[0].status;
            if (jobStatus === 'completed') {
              statusText = 'Analysis Ready';
              statusDot = 'bg-lime-400';
              statusTextClass = 'text-lime-300';
            } else if (jobStatus === 'failed') {
              statusText = 'Failed';
              statusDot = 'bg-rose-500';
              statusTextClass = 'text-rose-400';
            } else {
              statusText = 'Processing...';
              statusDot = 'bg-orange-400';
              statusTextClass = 'text-orange-300';
            }
          }
          
          return { ...p, displayStatus: statusText, statusDot, statusTextClass };
        }));
        
        enrichedProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentProjects(enrichedProjects);
      }
    } catch (e) {
      console.error('Failed to fetch recent projects', e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleInitializeProject = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/projects', { 
        name: `Monolith_${Math.floor(Math.random() * 9000 + 1000)}`, 
        description: 'Microservice transformation workspace',
        source_type: 'github'
      });
      setProjectId(res.data.data.id);
    } catch (e) {
      console.error('Failed to create project', e);
    } finally {
      setLoading(false);
    }
  };

  const handleJobStarted = (jobId: string) => {
    navigate(`/dashboard/projects/${projectId}/analysis`);
  };

  return (
    <AppLayout title="Dashboard" onNewProjectClick={handleInitializeProject}>
      {/* Top Banner Title - Bold Uppercase Style from Reference Image */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black font-syne uppercase tracking-tight text-white">
            TRANSFORMATION DASHBOARD
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Analyzing monolithic architectures into scalable microservices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#141417] border border-[#222226] px-4 py-2 rounded-full flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse"></span>
            <span className="text-zinc-300 font-bold">System Status: Optimal</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Ingestion & Workspaces */}
        <div className="lg:col-span-2 space-y-6">

          {/* Ingest Repository Card (Reference Style) */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-lime-400 block mb-1">
                  INGESTION ENGINE
                </span>
                <h2 className="text-xl font-extrabold font-syne text-white uppercase tracking-tight">
                  TARGET MONOLITH CODEBASE
                </h2>
              </div>
              <span className="w-8 h-8 rounded-full bg-[#1e1e24] border border-[#2e2e36] flex items-center justify-center text-zinc-400">
                ...
              </span>
            </div>

            {!projectId ? (
              <div 
                onClick={handleInitializeProject}
                className="bg-[#0b0b0e] border-2 border-dashed border-[#27272e] hover:border-lime-400/80 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer group hover:bg-[#111115]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#16161b] border border-[#26262e] text-zinc-400 group-hover:text-lime-400 group-hover:border-lime-400/50 flex items-center justify-center mx-auto mb-4 transition-all group-hover:scale-110">
                  <FolderGit2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black font-syne text-white uppercase tracking-wide group-hover:text-lime-300">
                  {loading ? 'INITIALIZING WORKSPACE...' : 'CREATE NEW TRANSFORMATION WORKSPACE'}
                </h3>
                <p className="text-xs font-mono text-zinc-500 mt-2">
                  Upload ZIP archive or connect GitHub repository to begin parsing.
                </p>
              </div>
            ) : (
              <div className="bg-[#0b0b0e] border border-[#232328] rounded-2xl p-6">
                <UploadSource projectId={projectId} onJobStarted={handleJobStarted} />
              </div>
            )}
          </div>

          {/* Recent Workspaces Card */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 block mb-1">
                  RECENT ANALYSIS
                </span>
                <h2 className="text-xl font-extrabold font-syne text-white uppercase tracking-tight">
                  ACTIVE WORKSPACES
                </h2>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Total: {recentProjects.length}
              </span>
            </div>

            {loadingProjects ? (
              <div className="text-center p-12 text-zinc-500 text-xs font-mono animate-pulse">
                Fetching projects...
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-[#232328] rounded-2xl text-zinc-500 text-xs font-mono">
                No active transformation workspaces found. Click above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProjects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => navigate(`/dashboard/projects/${project.id}/analysis`)}
                    className="bg-[#0b0b0e] border border-[#232328] hover:border-zinc-500 rounded-2xl p-5 cursor-pointer transition-all group relative overflow-hidden hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-extrabold font-syne text-white text-base truncate pr-2">
                        {project.name}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                    </div>

                    <p className="text-[11px] font-mono text-zinc-400 mb-4">
                      {project.description || 'Monolith Transformation'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1a1a1f]">
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>

                      <div className="inline-flex items-center gap-2 bg-[#16161b] px-3 py-1 rounded-full border border-[#26262e]">
                        <span className={`w-2 h-2 rounded-full ${project.statusDot}`}></span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${project.statusTextClass}`}>
                          {project.displayStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: System Health & Execution Logs (Inspired by Right Side Cards in Screenshot) */}
        <div className="space-y-6">

          {/* System Services Card */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-extrabold font-syne text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-lime-400" />
                INFRASTRUCTURE STATUS
              </h3>
              <span className="w-2 h-2 rounded-full bg-lime-400"></span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3.5 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">api-gateway</span>
                <span className="text-lime-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3.5 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">ai-analysis-engine</span>
                <span className="text-lime-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3.5 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">neo4j-graph-db</span>
                <span className="text-lime-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3.5 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">redis-task-queue</span>
                <span className="text-lime-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Card (Inspired by Left Pill Grid in Screenshot) */}
          <div className="bg-[#141417] border border-[#232328] rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-extrabold font-syne text-white uppercase tracking-wider mb-4">
              CAPABILITY SUMMARY
            </h3>
            
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-[#0b0b0e] border border-[#1f1f26] p-4 rounded-2xl text-center">
                <span className="text-2xl font-black text-lime-400 block font-syne">100%</span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mt-1">AST Coverage</span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1f1f26] p-4 rounded-2xl text-center">
                <span className="text-2xl font-black text-orange-400 block font-syne">4</span>
                <span className="text-[10px] text-zinc-500 uppercase font-bold block mt-1">Decomp Strategies</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
