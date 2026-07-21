import React from 'react';
import { Download, FileCheck, Calendar, ShieldAlert, Sparkles, Layers } from 'lucide-react';

export interface BlueprintRecord {
  id: string;
  project_id: string;
  scenario_revision_id: string;
  plan_revision_id: string;
  version_number: number;
  status: string;
  manifest: any;
  created_at: string;
}

interface BlueprintCatalogProps {
  blueprints: BlueprintRecord[];
  onGenerate: () => void;
  onInspect: (blueprint: BlueprintRecord) => void;
  onDownload: (blueprint: BlueprintRecord) => void;
  generating: boolean;
}

export const BlueprintCatalog: React.FC<BlueprintCatalogProps> = ({
  blueprints,
  onGenerate,
  onInspect,
  onDownload,
  generating
}) => {
  return (
    <div className="space-y-6">
      
      {/* Disclaimer Banner */}
      <div className="app-card p-4 sm:p-5 bg-gradient-to-r from-[#141417] to-[#1a1810] border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Engineering & Security Disclaimer
            </h4>
            <p className="text-xs text-zinc-300 mt-0.5">
              Generated OpenAPI specs, Dockerfiles, and Kubernetes manifests are starting points that require platform and security team review before production deployment.
            </p>
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={generating}
          className="btn-primary text-xs shrink-0 flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generating ? 'Generating Package...' : 'Generate New Blueprint'}
        </button>
      </div>

      {/* Blueprint Grid */}
      {blueprints.length === 0 ? (
        <div className="app-card p-12 text-center border-dashed border-[#232328]">
          <div className="w-12 h-12 rounded-2xl bg-[#09090b] border border-[#232328] text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white font-display">No Architecture Blueprints Generated</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            Package your reviewed microservice decomposition scenario and migration plan into a versioned engineering blueprint.
          </p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="btn-primary text-xs mt-5 inline-flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate First Blueprint Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {blueprints.map((bp) => {
            const artifactCount = bp.manifest?.artifacts?.length || 0;
            return (
              <div
                key={bp.id}
                className="app-card p-6 flex flex-col justify-between hover:border-zinc-500 transition-all group"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2 bg-[#09090b] border border-[#232328] px-3 py-1 rounded-full text-xs font-mono text-lime-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400"></span>
                      Blueprint Package v{bp.version_number}
                    </div>

                    <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-600" />
                      {new Date(bp.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Metadata */}
                  <h3 className="text-base font-bold font-display text-white mb-2">
                    Microservices Architecture Blueprint
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-2 my-4 text-xs font-medium">
                    <div className="bg-[#09090b] border border-[#1e1e24] p-3 rounded-xl">
                      <span className="text-zinc-500 text-[10px] uppercase block">Package Contents</span>
                      <span className="text-white font-bold font-mono">{artifactCount} Artifacts</span>
                    </div>

                    <div className="bg-[#09090b] border border-[#1e1e24] p-3 rounded-xl">
                      <span className="text-zinc-500 text-[10px] uppercase block">Validation</span>
                      <span className="text-lime-400 font-bold flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" /> Verified SHA-256
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-[#1f1f23] flex items-center justify-between gap-3">
                  <button
                    onClick={() => onInspect(bp)}
                    className="btn-secondary text-xs flex-1 flex items-center justify-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-zinc-400" />
                    Inspect Manifest
                  </button>

                  <button
                    onClick={() => onDownload(bp)}
                    className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download ZIP
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
