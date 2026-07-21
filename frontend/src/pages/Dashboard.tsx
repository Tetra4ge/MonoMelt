import React, { useState, useEffect } from 'react';
import { FolderGit2, Activity, ChevronRight } from 'lucide-react';
import { UploadSource } from '../components/projects/UploadSource';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import AppLayout from '../components/layout/AppLayout';

const Dashboard: React.FC = () => {
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
          let statusDot = 'bg-[#808080]';
          let statusTextClass = 'text-[#BEBEBE]';
          
          if (jobs && jobs.length > 0) {
            const jobStatus = jobs[0].status;
            if (jobStatus === 'completed') {
              statusText = 'Analysis Ready';
              statusDot = 'bg-[#B8FF45]';
              statusTextClass = 'text-[#B8FF45]';
            } else if (jobStatus === 'failed') {
              statusText = 'Failed';
              statusDot = 'bg-[#FF5A5F]';
              statusTextClass = 'text-[#FF5A5F]';
            } else {
              statusText = 'Processing...';
              statusDot = 'bg-[#FFA62B]';
              statusTextClass = 'text-[#FFA62B]';
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

  const handleJobStarted = () => {
    navigate(`/dashboard/projects/${projectId}/analysis`);
  };

  return (
    <AppLayout onNewProjectClick={handleInitializeProject}>
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bebas text-4xl sm:text-5xl text-white tracking-wide">
            TRANSFORMATION DASHBOARD
          </h1>
          <p className="text-xs text-[#BEBEBE] font-medium mt-0.5">
            Decomposing monolithic codebases into scalable microservices architectures
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#181818] border border-white/5 px-4 py-2 rounded-full flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#B8FF45] animate-pulse"></span>
            <span className="text-[#BEBEBE] font-semibold">System Status: Optimal</span>
          </div>
        </div>
      </div>

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Ingestion & Active Workspaces */}
        <div className="lg:col-span-8 space-y-6">

          {/* Target Monolith Ingestion Card */}
          <div className="neo-card p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#B8FF45] block mb-1">
                  INGESTION ENGINE
                </span>
                <h2 className="font-bebas text-2xl text-white tracking-wide">
                  TARGET MONOLITH CODEBASE
                </h2>
              </div>
              <span className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-[#BEBEBE] text-xs font-bold">
                01
              </span>
            </div>

            {!projectId ? (
              <div 
                onClick={handleInitializeProject}
                className="bg-[#181818] border-2 border-dashed border-[#262626] hover:border-[#B8FF45] rounded-[18px] p-8 sm:p-12 text-center transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-[16px] bg-[#262626] text-[#BEBEBE] group-hover:text-[#B8FF45] flex items-center justify-center mx-auto mb-4 transition-all group-hover:scale-110">
                  <FolderGit2 className="w-7 h-7" />
                </div>
                <h3 className="font-bebas text-xl text-white tracking-wide group-hover:text-[#B8FF45]">
                  {loading ? 'INITIALIZING WORKSPACE...' : 'CREATE NEW TRANSFORMATION WORKSPACE'}
                </h3>
                <p className="text-xs text-[#808080] mt-2 font-medium">
                  Upload ZIP archive or connect GitHub repository to begin AST parsing.
                </p>
              </div>
            ) : (
              <div className="bg-[#181818] rounded-[18px] p-6">
                <UploadSource projectId={projectId} onJobStarted={handleJobStarted} />
              </div>
            )}
          </div>

          {/* Active Workspaces Card */}
          <div className="neo-card p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#FFA62B] block mb-1">
                  RECENT ANALYSIS
                </span>
                <h2 className="font-bebas text-2xl text-white tracking-wide">
                  ACTIVE WORKSPACES
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#808080]">
                Total: {recentProjects.length}
              </span>
            </div>

            {loadingProjects ? (
              <div className="text-center p-12 text-[#808080] text-xs font-medium animate-pulse">
                Fetching projects...
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center p-12 bg-[#181818] rounded-[18px] text-[#808080] text-xs font-medium">
                No active transformation workspaces found. Click above to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recentProjects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => navigate(`/dashboard/projects/${project.id}/analysis`)}
                    className="bg-[#181818] hover:bg-[#252525] rounded-[18px] p-5 cursor-pointer transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bebas text-xl text-white truncate pr-2">
                        {project.name}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-[#808080] group-hover:text-[#B8FF45] group-hover:translate-x-1 transition-all shrink-0" />
                    </div>

                    <p className="text-xs text-[#BEBEBE] mb-4 font-medium truncate">
                      {project.description || 'Monolith Transformation'}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[10px] text-[#808080] font-mono">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>

                      <div className="inline-flex items-center gap-2 bg-[#262626] px-3 py-1 rounded-full">
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

        {/* Right Column (4 cols): Infrastructure Status & Capabilities */}
        <div className="lg:col-span-4 space-y-6">

          {/* Infrastructure Health Card */}
          <div className="neo-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bebas text-xl text-white tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#B8FF45]" />
                INFRASTRUCTURE STATUS
              </h3>
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8FF45]"></span>
            </div>

            <div className="space-y-3 text-xs font-medium">
              <div className="bg-[#181818] p-3.5 rounded-[16px] flex items-center justify-between">
                <span className="text-[#BEBEBE]">api-gateway</span>
                <span className="text-[#B8FF45] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8FF45]"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#181818] p-3.5 rounded-[16px] flex items-center justify-between">
                <span className="text-[#BEBEBE]">ai-analysis-engine</span>
                <span className="text-[#B8FF45] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8FF45]"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#181818] p-3.5 rounded-[16px] flex items-center justify-between">
                <span className="text-[#BEBEBE]">neo4j-graph-db</span>
                <span className="text-[#B8FF45] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8FF45]"></span> ONLINE
                </span>
              </div>

              <div className="bg-[#181818] p-3.5 rounded-[16px] flex items-center justify-between">
                <span className="text-[#BEBEBE]">redis-task-queue</span>
                <span className="text-[#B8FF45] font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8FF45]"></span> ONLINE
                </span>
              </div>
            </div>
          </div>

          {/* Capability Summary Metrics Card */}
          <div className="neo-card p-6">
            <h3 className="font-bebas text-xl text-white tracking-wide mb-4">
              CAPABILITY METRICS
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#181818] p-4 rounded-[16px] text-center">
                <span className="text-3xl font-extrabold text-[#B8FF45] block font-inter">100%</span>
                <span className="text-[10px] text-[#808080] uppercase font-bold block mt-1">AST Parsing</span>
              </div>

              <div className="bg-[#181818] p-4 rounded-[16px] text-center">
                <span className="text-3xl font-extrabold text-[#FFA62B] block font-inter">4</span>
                <span className="text-[10px] text-[#808080] uppercase font-bold block mt-1">Scenarios</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
