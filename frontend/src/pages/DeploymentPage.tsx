import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Rocket, Download } from 'lucide-react';
import { triggerDeployment, getDeploymentLogs, getServicesHealth } from '../features/deployment/deployment.api';
import type { Deployment, ServiceHealth } from '../features/deployment/types';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import PipelineVisualizer from '../components/deployment/PipelineVisualizer';
import LiveTerminal from '../components/deployment/LiveTerminal';
import ServicesDashboard from '../components/deployment/ServicesDashboard';
import ThemeToggle from '../components/common/ThemeToggle';

export default function DeploymentPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const blueprintId = queryParams.get('blueprintId');

  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startedFor = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Never leave the poller running after the page unmounts.
  useEffect(() => stopPolling, [stopPolling]);

  const startDeployment = useCallback(async () => {
    if (!projectId || !blueprintId) return;
    
    setIsDeploying(true);
    setError(null);

    try {
      // 1. Trigger the deployment
      const currentDeployment = await triggerDeployment(projectId, blueprintId);
      setDeployment(currentDeployment);

      // 2. Poll for logs and status updates
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getDeploymentLogs(projectId, currentDeployment.id);
          // Status is controlled entirely by the backend
          setDeployment(updated);

          // 3. When deployed, fetch health metrics and stop polling
          if (updated.status === 'deployed') {
            stopPolling();
            setIsDeploying(false);
            setServices(await getServicesHealth(projectId, currentDeployment.id));
          } else if (updated.status === 'failed') {
            stopPolling();
            setIsDeploying(false);
            setError('Deployment failed. Check the logs above.');
          }
        } catch (pollError) {
          stopPolling();
          setIsDeploying(false);
          setError(getErrorMessage(pollError, 'Lost connection to the deployment.'));
        }
      }, 2000);

    } catch (err) {
      setError(getErrorMessage(err, 'Failed to start deployment.'));
      setIsDeploying(false);
    }
  }, [projectId, blueprintId, stopPolling]);

  // Start exactly once per blueprint (the ref also survives StrictMode's double-invoked effects). Without this guard a failed start (which
  // leaves `deployment` null) would re-trigger this effect and retry forever.
  useEffect(() => {
    if (!projectId || !blueprintId || startedFor.current === blueprintId) return;
    startedFor.current = blueprintId;
    void startDeployment();
  }, [projectId, blueprintId, startDeployment]);

  const retryDeployment = () => {
    setDeployment(null);
    setServices([]);
    void startDeployment();
  };

  const handleDownload = async () => {
    if (!projectId || !blueprintId) return;
    try {
      const response = await api.get(`/api/projects/${projectId}/blueprints/${blueprintId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `blueprint-${blueprintId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to download blueprint.'));
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-gray-300 sm:p-8">
      <div className="mx-auto max-w-[1500px]">
        
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-600">monomelt / deployment_engineering</p>
            <h1 className="mt-2 text-2xl font-bold text-white">&gt; live_deployment</h1>
            <p className="mt-2 text-xs text-gray-500">Monitor CI/CD pipeline and microservice health.</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button 
              type="button" 
              onClick={() => navigate(`/dashboard/projects/${projectId}/export`)} 
              className="border border-[#222] bg-[#111] px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:border-white hover:text-white"
            >
              Back to Export
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/50 p-4 rounded-sm">
            <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error}</p>
            {blueprintId && !isDeploying && (
              <button
                onClick={retryDeployment}
                className="mt-3 border border-red-900/60 px-3 py-1 text-xs font-bold uppercase text-red-300 hover:bg-red-900/30"
              >
                Retry deployment
              </button>
            )}
          </div>
        )}

        {/* State: Missing Blueprint */}
        {!blueprintId && !deployment && (
          <div className="flex flex-col items-center justify-center py-20 border border-[#222] bg-[#111] rounded-md">
            <h2 className="text-xl font-bold text-white mb-2">No Blueprint Selected</h2>
            <p className="text-gray-400 mb-6 max-w-lg text-center text-sm">
              Please go back to Infrastructure Export and trigger a deployment from there.
            </p>
            <button
              onClick={() => navigate(`/dashboard/projects/${projectId}/export`)}
              className="bg-[#222] hover:bg-[#333] text-white px-8 py-3 font-bold uppercase tracking-widest text-sm transition-colors"
            >
              Back to Export
            </button>
          </div>
        )}

        {/* State: Deploying (Pipeline & Logs) */}
        {deployment && deployment.status !== 'deployed' && (
          <div className="space-y-6">
            <PipelineVisualizer status={deployment.status} />
            <LiveTerminal logs={deployment.logs} />
          </div>
        )}

        {/* State: Deployed (Dashboard) */}
        {deployment && deployment.status === 'deployed' && services.length > 0 && (
          <div className="space-y-8 animate-in fade-in duration-700">
            <PipelineVisualizer status="deployed" />
            
            <div className="pt-4 border-t border-[#222]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Rocket className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-xl font-bold text-white">Live Services Dashboard</h2>
                </div>
                <button
                  onClick={handleDownload}
                  className="bg-[#222] hover:bg-[#333] border border-[#333] text-white px-6 py-2 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download ZIP
                </button>
              </div>
              <ServicesDashboard services={services} />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
