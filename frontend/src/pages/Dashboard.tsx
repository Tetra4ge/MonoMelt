import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { LogOut, FolderGit2, Activity, Terminal } from 'lucide-react';
import { UploadSource } from '../components/projects/UploadSource';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    navigate('/');
    await signOut();
  };

  const handleInitializeProject = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/projects', { 
        name: 'Monomelt Auto Project', 
        description: 'Generated from dashboard',
        source_type: 'github' // Required by Supabase schema
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
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-[#222] pb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-white shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-logo tracking-widest text-gray-200">monomelt</h1>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
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
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111] border border-[#222] rounded-sm p-8">
              
              <h2 className="text-xl font-bold text-white mb-2">&gt; ingest_repository</h2>
              <p className="text-gray-500 mb-6 text-sm">Target a GitHub repository for AST parsing and modular extraction.</p>
              
              {!projectId ? (
                <div 
                  onClick={handleInitializeProject}
                  className="border border-dashed border-[#444] rounded-sm p-12 text-center hover:bg-[#1a1a1a] hover:border-gray-500 transition-colors cursor-pointer"
                >
                  <FolderGit2 className="w-10 h-10 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-gray-300">Initialize New Project Workspace</h3>
                  <p className="text-xs text-gray-600 mt-2">{loading ? 'Creating...' : 'Click to begin ingestion flow'}</p>
                </div>
              ) : (
                <UploadSource projectId={projectId} onJobStarted={handleJobStarted} />
              )}
            </div>
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-6">
            <div className="bg-[#111] border border-[#222] rounded-sm p-6">
              <div className="flex items-center gap-3 mb-6 text-white">
                <Activity className="w-4 h-4" />
                <h3 className="font-bold text-sm tracking-wide">SYSTEM_STATUS</h3>
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-gray-500">api-gateway</span>
                  <span className="text-emerald-500 font-bold">ONLINE</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-gray-500">ai-service</span>
                  <span className="text-emerald-500 font-bold">ONLINE</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-gray-500">neo4j_graph</span>
                  <span className="text-gray-600 font-bold">OFFLINE</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-sm p-6">
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
