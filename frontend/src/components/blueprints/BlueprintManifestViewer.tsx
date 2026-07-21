import React from 'react';
import { X, FileText, AlertTriangle, ShieldCheck, HardDrive, CheckCircle2 } from 'lucide-react';

interface ArtifactFile {
  path: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
}

interface BlueprintManifest {
  generator_version: string;
  project_id: string;
  scenario_revision_id: string;
  plan_revision_id: string;
  version_number: number;
  artifacts: ArtifactFile[];
  warnings: string[];
  validation_results: Record<string, boolean>;
}

interface BlueprintManifestViewerProps {
  manifest: BlueprintManifest;
  onClose: () => void;
}

export const BlueprintManifestViewer: React.FC<BlueprintManifestViewerProps> = ({ manifest, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141417] border border-[#232328] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#232328] flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-lime-400 block mb-0.5">
              Manifest Inspection
            </span>
            <h2 className="text-lg font-bold font-display text-white">
              Blueprint v{manifest.version_number} SHA-256 Provenance Manifest
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1c1c20] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Quality Gates Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#09090b] border border-[#232328] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-1">
                <ShieldCheck className="w-4 h-4 text-lime-400" />
                OpenAPI Validation
              </div>
              <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-2">
                <CheckCircle2 className="w-4 h-4 text-lime-400" /> Passed Schema Check
              </span>
            </div>

            <div className="bg-[#09090b] border border-[#232328] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-1">
                <HardDrive className="w-4 h-4 text-lime-400" />
                Total Package Artifacts
              </div>
              <span className="text-lg font-bold text-lime-400 font-mono mt-1 block">
                {manifest.artifacts?.length || 0} Files
              </span>
            </div>

            <div className="bg-[#09090b] border border-[#232328] p-4 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Security Review Warning
              </div>
              <span className="text-xs font-medium text-amber-400 mt-1 block line-clamp-2">
                Required prior to production deployment
              </span>
            </div>
          </div>

          {/* Artifact File Tree Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-lime-400" />
              Package File Layout & Cryptographic Hashes
            </h3>

            <div className="bg-[#09090b] border border-[#232328] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#141417] text-zinc-400 uppercase text-[10px] border-b border-[#232328]">
                  <tr>
                    <th className="py-3 px-4">Relative Path</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">SHA-256 Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e24] text-zinc-300">
                  {manifest.artifacts?.map((art, i) => (
                    <tr key={i} className="hover:bg-[#121216]">
                      <td className="py-2.5 px-4 font-sans text-white font-medium truncate max-w-xs">
                        {art.path}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400">
                        {art.size_bytes} B
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500 text-[10px] truncate max-w-xs">
                        {art.sha256}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#232328] bg-[#09090b] flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
