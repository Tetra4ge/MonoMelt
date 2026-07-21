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
    <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col font-inter antialiased selection:bg-[#B8FF45] selection:text-black">
      {/* Top Header Navigation Bar */}
      <header className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-[#0B0B0B]/95 backdrop-blur-md sticky top-0 z-40">
        {/* Left: Logo & Nav Pills */}
        <div className="flex items-center gap-6">
          <div 
            onClick={() => navigate('/dashboard')}
            className="w-12 h-12 rounded-full bg-[#B8FF45] text-black font-bebas text-2xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-md"
          >
            NI
          </div>
          
          {/* Nav Pills */}
          <nav className="hidden md:flex items-center gap-2 bg-[#181818] p-1.5 rounded-full">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                isCurrentRoute('/dashboard')
                  ? 'bg-[#B8FF45] text-black font-bold shadow'
                  : 'text-[#BEBEBE] hover:text-white hover:bg-[#252525]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Dashboard
            </button>

            {activeProjectId && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/analysis`)}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    location.pathname.includes('/analysis')
                      ? 'bg-[#B8FF45] text-black font-bold shadow'
                      : 'text-[#BEBEBE] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  Code Analysis
                </button>

                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/plans`)}
                  className={`px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                    location.pathname.includes('/plans')
                      ? 'bg-[#B8FF45] text-black font-bold shadow'
                      : 'text-[#BEBEBE] hover:text-white hover:bg-[#252525]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Migration Roadmap
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right: Search Input & Profile */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 bg-[#181818] px-4 py-2 rounded-full text-xs text-[#BEBEBE] w-64 focus-within:bg-[#252525] transition-colors">
            <Search className="w-4 h-4 text-[#808080]" />
            <input
              type="text"
              placeholder="Search components or microservices..."
              className="bg-transparent border-none outline-none text-white placeholder-[#808080] w-full text-xs font-medium"
            />
          </div>

          {/* Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 bg-[#181818] pl-3 pr-4 py-1.5 rounded-full hover:bg-[#252525] transition-all cursor-pointer"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#B8FF45] text-black font-bold flex items-center justify-center text-xs">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <span className="text-xs font-semibold text-white block leading-tight">{userName}</span>
                <span className="text-[10px] text-[#808080] block font-mono">@{user?.email?.split('@')[0]}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#808080]" />
            </button>

            {/* Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1E1E1E] border border-white/5 rounded-[18px] shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <span className="text-xs font-semibold text-white block">{userName}</span>
                  <span className="text-[10px] text-[#808080] block truncate">{user?.email}</span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#FF5A5F] hover:bg-[#FF5A5F]/10 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container with 72px Floating Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Floating Sidebar (72px wide, 56x56 round buttons) */}
        <aside className="w-[72px] bg-[#0B0B0B] border-r border-white/5 py-6 flex flex-col items-center justify-between shrink-0">
          <div className="flex flex-col items-center gap-5">
            <button
              onClick={() => navigate('/dashboard')}
              title="Dashboard"
              className={`sidebar-round-btn ${isCurrentRoute('/dashboard') ? 'active' : ''}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>

            {activeProjectId && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/analysis`)}
                  title="Code Analysis"
                  className={`sidebar-round-btn ${location.pathname.includes('/analysis') ? 'active' : ''}`}
                >
                  <GitBranch className="w-5 h-5" />
                </button>

                <button
                  onClick={() => navigate(`/dashboard/projects/${activeProjectId}/plans`)}
                  title="Migration Roadmap"
                  className={`sidebar-round-btn ${location.pathname.includes('/plans') ? 'active' : ''}`}
                >
                  <Calendar className="w-5 h-5" />
                </button>
              </>
            )}

            <button
              title="Settings"
              className="sidebar-round-btn"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Create Project Button */}
          <button
            onClick={onNewProjectClick || (() => navigate('/dashboard'))}
            title="Create New Project"
            className="sidebar-round-btn hover:text-[#B8FF45] group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-8 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
