import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { LogOut, FolderGit2, Cpu, Activity } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-400 font-sans">
        Initializing Workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Cpu className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">MonoMELT</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 text-sm text-gray-400">
              <img 
                src={user?.user_metadata?.avatar_url || 'https://github.com/identicons/default.png'} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full border border-gray-700"
              />
              <span>{user?.user_metadata?.user_name || user?.email}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-gray-900/50 hover:bg-gray-800 px-4 py-2 rounded-lg border border-gray-800"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Action Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px]" />
              
              <h2 className="text-2xl font-bold mb-2">Upload Monolith</h2>
              <p className="text-gray-400 mb-6">Connect a GitHub repository to begin AST parsing and extraction.</p>
              
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:bg-gray-900/30 hover:border-gray-500 transition-all cursor-pointer">
                <FolderGit2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-300">Paste GitHub URL</h3>
                <p className="text-sm text-gray-500 mt-2">Currently waiting for Phase 2 implementation...</p>
              </div>
            </div>
          </div>

          {/* Sidebar / Stats */}
          <div className="space-y-6">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4 text-emerald-400">
                <Activity className="w-5 h-5" />
                <h3 className="font-semibold text-white">System Status</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">API Gateway</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Online</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">AI Service</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Online</span>
                </div>
              </div>
            </div>

            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-xl opacity-60">
              <h3 className="font-semibold text-white mb-4">Recent Transformations</h3>
              <p className="text-sm text-gray-500 text-center py-8">No transformations yet.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
