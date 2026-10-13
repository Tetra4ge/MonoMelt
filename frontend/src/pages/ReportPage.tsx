import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useProjectReport } from '../hooks/useProjectReport';
import { useReportSocket } from '../hooks/useReportSocket';
import { ExecutiveSummary } from '../components/report/ExecutiveSummary';
import { CostProjectionsChart } from '../components/report/CostProjectionsChart';
import { DecompositionGrid } from '../components/report/DecompositionGrid';
import { RiskMatrix } from '../components/report/RiskMatrix';
import { Loader2, Terminal, LogOut, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';

export default function ReportPage() {
  const { projectId } = useParams();
  const { signOut } = useAuthStore();
  const { data, isLoading, isError } = useProjectReport(projectId!);
  useReportSocket(projectId);
  const queryClient = useQueryClient();
  const [isQueueing, setIsQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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

  const handleExportToNotion = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await api.post(`/api/projects/${projectId}/reports/export/notion`);
      if (res.data?.notion_url) {
        setNotionUrl(res.data.notion_url);
        await queryClient.invalidateQueries({ queryKey: ['report', projectId] });
      }
    } catch (err) {
      setExportError(getErrorMessage(err, 'Failed to export to Notion. The MCP server may be unavailable.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerate = async () => {
    setIsQueueing(true);
    setQueueError(null);
    try {
      await api.post(`/api/projects/${projectId}/reports/generate`);
      await queryClient.invalidateQueries({ queryKey: ['report', projectId] });
    } catch (err) {
      setQueueError(getErrorMessage(err, 'Could not queue report generation.'));
    } finally {
      setIsQueueing(false);
    }
  };

  // No report yet, or the last one failed: say so and let the user (re)generate it.
  if (!report || report.status === 'failed') {
    const failed = report?.status === 'failed';
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4 font-mono px-6 text-center">
        <h2 className="text-xl font-bold text-white tracking-widest">
          &gt; {failed ? 'report_generation_failed' : 'no_report_yet'}
        </h2>
        <p className="text-gray-500 text-xs max-w-md">
          {failed
            ? (report?.payload?.error || 'The last attempt failed.')
            : 'Reports are generated after a blueprint is created. You can also queue one now if a migration plan exists.'}
        </p>
        {queueError && <p className="text-red-400 text-xs">{queueError}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isQueueing}
            className="px-6 py-2 bg-white text-black font-bold rounded-sm hover:bg-gray-200 transition disabled:opacity-50 text-xs tracking-wide uppercase"
          >
            {isQueueing ? 'Queueing...' : failed ? 'Retry report' : 'Generate report'}
          </button>
          <Link
            to={`/dashboard/projects/${projectId}/export`}
            className="px-6 py-2 border border-[#333] text-gray-300 hover:text-white rounded-sm text-xs tracking-wide uppercase"
          >
            Back to export
          </Link>
        </div>
      </div>
    );
  }

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
          
          <div className="flex items-center gap-4">
            {notionUrl || report?.notion_url ? (
              <a
                href={notionUrl || report?.notion_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-2 border border-[#333] text-gray-300 hover:text-white font-bold rounded-sm text-xs tracking-wide uppercase transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Notion
              </a>
            ) : (
              <button
                onClick={handleExportToNotion}
                disabled={isExporting}
                className="px-6 py-2 bg-white text-black font-bold rounded-sm hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-wait text-xs tracking-wide uppercase"
              >
                {isExporting ? 'Exporting...' : 'Export to Notion'}
              </button>
            )}
            {exportError && (
              <span className="text-red-400 text-xs max-w-xs truncate" title={exportError}>
                {exportError}
              </span>
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

          <div className="xl:col-span-3">
            <RiskMatrix data={report?.payload?.risk_assessment} />
          </div>

        </div>
      </div>
    </div>
  );
}
