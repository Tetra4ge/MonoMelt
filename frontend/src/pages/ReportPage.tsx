import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useProjectReport } from '../hooks/useProjectReport';
import { ExecutiveSummary } from '../components/report/ExecutiveSummary';
import { CostProjectionsChart } from '../components/report/CostProjectionsChart';
import { DecompositionGrid } from '../components/report/DecompositionGrid';
import { Loader2, ArrowUpRight, Terminal, LogOut } from 'lucide-react';
import api from '../lib/api';

export default function ReportPage() {
  const { projectId } = useParams();
  const { user, signOut } = useAuthStore();
  const { data, isLoading, isError } = useProjectReport(projectId!);
  const [isExporting, setIsExporting] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-mono">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-mono text-red-500 text-sm">
        [ERROR]: Failed to load report data.
      </div>
    );
  }

  const report = data?.data;

  // Render polling state
  if (report?.status === 'generating' || report?.status === 'pending') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-6 font-mono">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <h2 className="text-xl font-bold text-white tracking-widest">&gt; generating_report...</h2>
        <p className="text-gray-500 text-xs">Aggregating Neo4j and PostgreSQL metrics.</p>
      </div>
    );
  }

  const handleNotionExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.post(`/api/reports/${projectId}/export-to-notion`);
      setNotionUrl(res.data.notion_url);
    } catch (err) {
      console.error("Failed to export to Notion", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-8 font-mono">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-[#222] pb-6">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-white shrink-0" />
            <Link to="/dashboard">
              <h1 className="text-2xl sm:text-3xl font-logo tracking-widest text-gray-200 hover:text-white transition-colors cursor-pointer">monomelt</h1>
            </Link>
            <span className="text-gray-600 text-xl font-light">/</span>
            <span className="text-blue-400 text-sm font-bold tracking-widest">REPORT</span>
          </div>
          
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm font-bold hidden sm:block">
              DASHBOARD
            </Link>
            <button 
              onClick={signOut}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#111] hover:bg-[#222] px-4 py-2 rounded-sm border border-[#222] text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              EXIT
            </button>
          </div>
        </header>
        
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-8 bg-[#111] border border-[#222] p-4 shadow-xl">
          <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
            <span>Project_ID: {projectId?.substring(0,8)}</span>
            <span>|</span>
            <span>Version: {report?.version_number || 1}</span>
          </div>
          
          <div className="flex gap-4">
            {notionUrl ? (
              <a href={notionUrl} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-sm hover:bg-blue-500/20 transition text-xs font-bold tracking-wide">
                View in Notion <ArrowUpRight className="ml-2 w-4 h-4" />
              </a>
            ) : (
              <button 
                onClick={handleNotionExport} 
                disabled={isExporting}
                className="px-6 py-2 bg-white text-black font-bold rounded-sm hover:bg-gray-200 transition disabled:opacity-50 text-xs tracking-wide uppercase"
              >
                {isExporting ? 'Exporting...' : 'Export to Notion'}
              </button>
            )}
          </div>
        </div>

        {/* Grid Layout for Sub-components */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          <div className="xl:col-span-3">
             {/* Passes the nested JSON payload down as props */}
            <ExecutiveSummary data={report?.payload?.executive_summary} />
          </div>

          <div className="xl:col-span-2">
            <DecompositionGrid data={report?.payload?.decomposition_strategy} />
          </div>

          <div className="xl:col-span-1">
            <CostProjectionsChart data={report?.payload?.cost_analysis} />
          </div>

        </div>
      </div>
    </div>
  );
}
