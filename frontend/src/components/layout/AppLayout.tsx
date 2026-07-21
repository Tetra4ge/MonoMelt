import React, { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LayoutGrid,
  GitBranch,
  Calendar,
  Settings,
  Plus,
  Search,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  onNewProjectClick?: () => void;
}

export default function AppLayout({ children, onNewProjectClick }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { user, signOut } = useAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const activeProjectId = projectId || '';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Architect';
  const userAvatar = user?.user_metadata?.avatar_url;

  const isCurrentRoute = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans antialiased selection:bg-lime-400 selection:text-black">
      {/* Top Header Navigation Bar */}
      <header className="h-16 md:h-20 px-6 flex items-center justify-between border-b border-[#1f1f23] bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-40">
        {/* Left: Logo & Nav Pills */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => navigate('/')}
            className="text-xl md:text-2xl font-bold tracking-wider text-white cursor-pointer font-display flex items-center gap-2 hover:opacity-90 transition-opacity"
            title="Go to Home"
          >
            <span className="w-8 h-8 rounded-lg bg-lime-400 text-black flex items-center justify-center font-extrabold text-sm">m</span>
            <span>monomelt</span>
          </div>
          
          {/* Nav Pills for Project Scope */}
          {activeProjectId && (
            <nav className="hidden md:flex items-center gap-1.5 bg-[#141417] p-1 rounded-full border border-[#232328]">
              <button
                onClick={() => navigate(`/dashboard/projects/${activeProjectId}/analysis`)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                  location.pathname.includes('/analysis')
                    ? 'bg-white text-black shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Code Analysis
              </button>

              <button
                onClick={() => navigate(`/dashboard/projects/${activeProjectId}/plans`)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                  location.pathname.includes('/plans')
                    ? 'bg-white text-black shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Migration Roadmap
              </button>

              <button
                onClick={() => navigate(`/dashboard/projects/${activeProjectId}/blueprints`)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                  location.pathname.includes('/blueprints')
                    ? 'bg-white text-black shadow-md font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Architecture Blueprints
              </button>
            </nav>
          )}
        </div>

        {/* Right: Search & Profile */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 bg-[#141417] border border-[#232328] px-3.5 py-1.5 rounded-full text-xs text-zinc-400 w-60 focus-within:border-zinc-500 transition-colors">
            <Search className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search services..."
              className="bg-transparent border-none outline-none text-zinc-200 placeholder-zinc-500 w-full text-xs"
            />
          </div>

          {/* Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 bg-[#141417] border border-[#232328] pl-2 pr-3 py-1 rounded-full hover:border-zinc-700 transition-all cursor-pointer"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-zinc-700" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-lime-400 text-black font-bold flex items-center justify-center text-xs">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-white block leading-tight">{userName}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#141417] border border-[#26262e] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                  <span className="text-xs font-bold text-white block">{userName}</span>
                  <span className="text-[10px] text-zinc-400 block truncate">{user?.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/30 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Layout with Fixed Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Perfectly Aligned 72px column) */}
        <aside className="w-16 md:w-20 bg-[#09090b] border-r border-[#1f1f23] py-6 flex flex-col items-center justify-between shrink-0">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              title="Dashboard"
              className={`sidebar-btn ${isCurrentRoute('/dashboard') ? 'active' : ''}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            {activeProjectId && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/analysis`)}
                  title="Code Analysis"
                  className={`sidebar-btn ${location.pathname.includes('/analysis') ? 'active' : ''}`}
                >
                  <GitBranch className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/plans`)}
                  title="Migration Roadmap"
                  className={`sidebar-btn ${location.pathname.includes('/plans') ? 'active' : ''}`}
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </>
            )}

            <button
              title="Settings"
              className="sidebar-btn"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Plus Add Project Button at Bottom */}
          <button
            onClick={onNewProjectClick || (() => navigate('/dashboard'))}
            title="Create New Project"
            className="sidebar-btn hover:border-lime-400 hover:text-lime-400 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </aside>

        {/* Content Container (Centered & Constrained to max-w-7xl) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 min-w-0">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
