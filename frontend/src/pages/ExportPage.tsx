import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Download, FileText, Rocket } from 'lucide-react';
import { createBlueprint, getBlueprints, getBlueprint, getBlueprintFiles } from '../features/export/export.api';
import type { Blueprint } from '../features/export/types';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import BlueprintPreview from '../components/export/BlueprintPreview';
import GenerationStatus from '../components/export/GenerationStatus';
import ThemeToggle from '../components/common/ThemeToggle';

export default function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('planId');

  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (blueprintId: string) => {
    if (!projectId) return;
    try {
      setFiles(await getBlueprintFiles(projectId, blueprintId));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load the blueprint preview.'));
    }
  }, [projectId]);

  // Load the most recent blueprint (and its preview) when the page opens.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const blueprints = await getBlueprints(projectId);
        if (cancelled) return;
        if (blueprints.length > 0) {
          setBlueprint(blueprints[0]);
          if (blueprints[0].status === 'completed') await loadFiles(blueprints[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load blueprints.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, loadFiles]);

  // Only a blueprint that is still generating needs polling; the timer is cleaned up on unmount.
  useEffect(() => {
    if (!projectId || blueprint?.status !== 'generating') return;
    const id = blueprint.id;
    const timer = setInterval(async () => {
      try {
        const updated = await getBlueprint(projectId, id);
        setBlueprint(updated);
        if (updated.status === 'completed') await loadFiles(id);
      } catch (err) {
        setError(getErrorMessage(err, 'Lost track of the blueprint generation.'));
        clearInterval(timer);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [projectId, blueprint?.id, blueprint?.status, loadFiles]);

  const handleGenerate = async () => {
    if (!projectId || !planId) {
      setError('Missing Project ID or Plan ID. Please return to planning.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const created = await createBlueprint(projectId, planId);
      setFiles(created.files ?? {});
      setBlueprint(created);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate blueprints.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!projectId || !blueprint?.id) return;
    try {
      const response = await api.get(`/api/projects/${projectId}/blueprints/${blueprint.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `blueprint-v${blueprint.version_number}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to download blueprint.'));
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] font-mono text-xs text-gray-500">[ loading export workspace ]</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-gray-300 sm:p-8">
      <div className="mx-auto max-w-[1500px]">
        
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">monomelt / deployment_engineering</p>
            <h1 className="mt-2 text-2xl font-bold text-white">&gt; infrastructure_export</h1>
            <p className="mt-2 text-xs text-gray-500">Generate and preview Terraform artifacts for your microservices.</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button 
              type="button" 
              onClick={() => navigate(`/dashboard/projects/${projectId}/planning`)} 
              className="border border-[#222] bg-[#111] px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:border-white hover:text-white"
            >
              Back to Planning
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/50 p-4 rounded-sm">
            <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* State: No Blueprint */}
        {!blueprint && !generating && (
          <div className="flex flex-col items-center justify-center py-20 border border-[#222] bg-[#111] rounded-md">
            <Rocket className="w-16 h-16 text-gray-600 mb-6" />
            <h2 className="text-xl font-bold text-white mb-2">Ready for Generation</h2>
            <p className="text-gray-400 mb-8 max-w-lg text-center text-sm">
              You are about to generate production-ready Terraform modules and microservice boilerplate code based on Plan: <span className="text-gray-300 font-bold">{planId || 'Unknown'}</span>.
            </p>
            <button
              onClick={handleGenerate}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 font-bold uppercase tracking-widest text-sm transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              Start Generation
            </button>
          </div>
        )}

        {/* State: Generating */}
        {(generating || blueprint?.status === 'generating') && (
          <GenerationStatus status="generating" />
        )}

        {/* State: Generated */}
        {blueprint && !generating && blueprint.status === 'completed' && (
          <div className="space-y-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Generated Artifacts</h2>
                <p className="text-gray-500 text-xs mt-1">Review your infrastructure code before downloading.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleDownload}
                  className="bg-[#222] hover:bg-[#333] border border-[#333] text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download ZIP
                </button>
                <button
                  onClick={() => navigate(`/dashboard/projects/${projectId}/report`)}
                  className="bg-[#222] hover:bg-[#333] border border-[#333] text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Report
                </button>
                <button
                  onClick={() => navigate(`/dashboard/projects/${projectId}/deployment?blueprintId=${blueprint.id}`)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Rocket className="w-4 h-4" />
                  1-Click Deploy
                </button>
              </div>
            </div>
            
            <BlueprintPreview files={files} />
          </div>
        )}

      </div>
    </main>
  );
}
