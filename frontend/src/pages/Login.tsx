import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { GitBranch, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleGitHubLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:5173/dashboard'
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error logging in:', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-center items-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#1a1a1a] p-10 rounded-2xl border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px]" />
        
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">MonoMELT</h2>
          <p className="text-gray-400 mb-10 text-lg">Sign in to start transforming your legacy monoliths into modern microservices.</p>
          
          <button
            onClick={handleGitHubLogin}
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all duration-200 disabled:opacity-70 shadow-lg active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <GitBranch className="w-5 h-5" />
                Sign in with GitHub
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
