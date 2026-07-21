import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { BlueprintCatalog, type BlueprintRecord } from '../components/blueprints/BlueprintCatalog';
import { BlueprintManifestViewer } from '../components/blueprints/BlueprintManifestViewer';
import api from '../lib/api';

export const BlueprintPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<BlueprintRecord | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchBlueprints();
    }
  }, [projectId]);

  const fetchBlueprints = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/projects/${projectId}/blueprints`);
      if (res.data.success) {
        setBlueprints(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch blueprints:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    if (!projectId) return;
    try {
      setGenerating(true);

      // Fetch active scenarios and plans
      const [scenariosRes, plansRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/scenarios`),
        api.get(`/api/projects/${projectId}/plans`)
      ]);

      const scenarios = scenariosRes.data?.data || [];
      const plans = plansRes.data?.data || [];

      if (scenarios.length === 0 || plans.length === 0) {
        alert('Please complete Phase 5 Decomposition and Phase 6 Migration Planning first before generating blueprints.');
        return;
      }

      const activeScenario = scenarios[0];
      const activePlan = plans[0];

      const res = await api.post(`/api/projects/${projectId}/blueprints`, {
        scenarioRevisionId: activeScenario.id,
        planRevisionId: activePlan.id
      });

      if (res.data.success) {
        await fetchBlueprints();
      }
    } catch (e: any) {
      console.error('Generate Blueprint Error:', e);
      alert(e.response?.data?.message || 'Failed to generate blueprint package');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (blueprint: BlueprintRecord) => {
    window.open(`${api.defaults.baseURL}/api/projects/${projectId}/blueprints/${blueprint.id}/download`, '_blank');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lime-400 block mb-1">
              Phase 7 Output Package
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white tracking-tight">
              Architecture Blueprints & Artifact Export
            </h1>
          </div>
        </div>

        {/* Blueprint Catalog */}
        {loading ? (
          <div className="text-center p-12 text-zinc-500 text-xs animate-pulse">
            Loading architecture blueprints...
          </div>
        ) : (
          <BlueprintCatalog
            blueprints={blueprints}
            onGenerate={handleGenerateBlueprint}
            onInspect={(bp) => setSelectedBlueprint(bp)}
            onDownload={handleDownload}
            generating={generating}
          />
        )}

        {/* Manifest Inspector Modal */}
        {selectedBlueprint && (
          <BlueprintManifestViewer
            manifest={selectedBlueprint.manifest}
            onClose={() => setSelectedBlueprint(null)}
          />
        )}

      </div>
    </AppLayout>
  );
};

export default BlueprintPage;
