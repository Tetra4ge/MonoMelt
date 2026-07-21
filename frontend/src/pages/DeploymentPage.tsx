import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { triggerDeployment, getDeploymentLogs, getServicesHealth } from '../features/deployment/deployment.api';
import type { Deployment, ServiceHealth } from '../features/deployment/types';
import PipelineVisualizer from '../components/deployment/PipelineVisualizer';
import LiveTerminal from '../components/deployment/LiveTerminal';
import ServicesDashboard from '../components/deployment/ServicesDashboard';

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

  useEffect(() => {
    // If the user lands here with a blueprint ID, we automatically kick off the deployment simulation
    if (projectId && blueprintId && !isDeploying && !deployment) {
      startDeployment();
    }
  }, [projectId, blueprintId]);

  const startDeployment = async () => {
    if (!projectId || !blueprintId) return;
    
    setIsDeploying(true);
    setError(null);

    try {
      // 1. Trigger the deployment
      let currentDeployment = await triggerDeployment(projectId, blueprintId);
      setDeployment(currentDeployment);

      // 2. Poll for logs and status updates
      const pollInterval = setInterval(async () => {
        const updated = await getDeploymentLogs(projectId, currentDeployment.id);
        
        // Simulating progressive status updates based on log length
        if (updated.logs.length > 3) updated.status = 'provisioning';
        if (updated.logs.length >= 10) updated.status = 'deployed';

        setDeployment(updated);

        // 3. When deployed, fetch health metrics and stop polling
        if (updated.status === 'deployed') {
          clearInterval(pollInterval);
          setIsDeploying(false);
          const healthData = await getServicesHealth(projectId);
          setServices(healthData);
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to start deployment.');
      setIsDeploying(false);
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
          <button 
            type="button" 
            onClick={() => navigate(`/dashboard/projects/${projectId}/export`)} 
            className="border border-[#222] bg-[#111] px-4 py-2 text-xs font-bold uppercase text-gray-400 hover:border-white hover:text-white"
          >
            Back to Export
          </button>
        </header>

        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/50 p-4 rounded-sm">
            <p className="text-red-400 text-sm font-mono whitespace-pre-wrap">{error}</p>
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
              <div className="flex items-center gap-3 mb-6">
                <Rocket className="w-5 h-5 text-emerald-500" />
                <h2 className="text-xl font-bold text-white">Live Services Dashboard</h2>
              </div>
              <ServicesDashboard services={services} />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
