/* Project-list hydration intentionally updates local loading state from this effect. */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { Activity, ChevronRight, Sparkles } from 'lucide-react';
import { UploadSource } from '../components/projects/UploadSource';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import AppLayout from '../components/layout/AppLayout';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

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
              statusTextClass = 'text-lime-400';
            } else if (jobStatus === 'failed') {
              statusText = 'Failed';
              statusDot = 'bg-rose-500';
              statusTextClass = 'text-rose-400';
            } else {
              statusText = 'Processing...';
              statusDot = 'bg-amber-400';
              statusTextClass = 'text-amber-400';
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

  useEffect(() => {
    void fetchRecentProjects();
  }, []);

  const handleInitializeProject = async () => {
    try {
      const res = await api.post('/api/projects', { 
        name: `Monolith_${Math.floor(Math.random() * 9000 + 1000)}`, 
        description: 'Microservice transformation workspace',
        source_type: 'github'
      });
      setProjectId(res.data.data.id);
    } catch (e) {
      console.error('Failed to create project', e);
    }
  };

  return (
    <AppLayout onNewProjectClick={handleInitializeProject}>
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-white tracking-tight">
            Transformation Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Analyze legacy codebases, parse AST dependency graphs, and decompose into microservices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#141417] border border-[#232328] px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse"></span>
            <span className="text-zinc-300 font-medium">System Status: Optimal</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Ingestion & Workspaces */}
        <div className="lg:col-span-2 space-y-6">

          {/* Ingest Repository Card */}
          <div className="app-card p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-lime-400 block mb-1">
                  Ingestion Engine
                </span>
                <h2 className="text-lg font-bold font-display text-white">
                  Target Monolith Codebase
                </h2>
              </div>
            </div>

            <div className="bg-[#0b0b0e] border border-[#232328] rounded-2xl p-6">
              <UploadSource 
                projectId={projectId || undefined} 
                onJobStarted={(_jobId, targetId) => {
                  navigate(`/app/projects/${targetId || projectId}/analysis`);
                }} 
              />
            </div>
          </div>

          {/* Recent Workspaces Card */}
          <div className="app-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Workspaces
                </span>
                <h2 className="text-lg font-bold font-display text-white">
                  Active Analysis Workspaces
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                Total: {recentProjects.length}
              </span>
            </div>

            {loadingProjects ? (
              <div className="text-center p-10 text-zinc-500 text-xs animate-pulse">
                Loading projects...
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center p-10 border border-dashed border-[#232328] rounded-2xl text-zinc-500 text-xs">
                No active transformation workspaces found. Click above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProjects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => navigate(`/app/projects/${project.id}/analysis`)}
                    className="bg-[#0b0b0e] border border-[#232328] hover:border-zinc-500 rounded-2xl p-5 cursor-pointer transition-all group relative overflow-hidden hover:scale-[1.01]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold font-display text-white text-sm truncate pr-2">
                        {project.name}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                    </div>

                    <p className="text-xs text-zinc-400 mb-4 line-clamp-1">
                      {project.description || 'Monolith Transformation'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1a1a1f]">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>

                      <div className="inline-flex items-center gap-1.5 bg-[#16161b] px-2.5 py-0.5 rounded-full border border-[#26262e]">
                        <span className={`w-1.5 h-1.5 rounded-full ${project.statusDot}`}></span>
                        <span className={`text-[10px] font-bold uppercase ${project.statusTextClass}`}>
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

        {/* Right 1 Column: Infrastructure & Summary */}
        <div className="space-y-6">

          {/* Infrastructure Health Card */}
          <div className="app-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold font-display text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-lime-400" />
                Infrastructure Health
              </h3>
              <span className="w-2 h-2 rounded-full bg-lime-400"></span>
            </div>

            <div className="space-y-2.5 text-xs font-medium">
              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">api-gateway</span>
                <span className="text-lime-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">ai-analysis-engine</span>
                <span className="text-lime-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">neo4j-graph-db</span>
                <span className="text-lime-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1e1e24] p-3 rounded-xl flex items-center justify-between">
                <span className="text-zinc-400">redis-task-queue</span>
                <span className="text-lime-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span> ONLINE
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Card */}
          <div className="app-card p-6">
            <h3 className="text-sm font-bold font-display text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-lime-400" />
              Engine Metrics
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[#0b0b0e] border border-[#1f1f26] p-4 rounded-xl">
                <span className="text-2xl font-bold text-lime-400 block font-display">100%</span>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mt-1">AST Coverage</span>
              </div>

              <div className="bg-[#0b0b0e] border border-[#1f1f26] p-4 rounded-xl">
                <span className="text-2xl font-bold text-amber-400 block font-display">4</span>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold block mt-1">Strategies</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
