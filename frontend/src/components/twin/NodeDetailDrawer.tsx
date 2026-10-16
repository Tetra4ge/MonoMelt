import React from 'react';
import type { TwinNode } from '../../types/twin.types';
import { Cpu, HelpCircle, Layers, Database, Activity } from 'lucide-react';

interface NodeDetailDrawerProps {
  node: TwinNode | null;
  onClose: () => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({ node, onClose }) => {
  if (!node) return null;

  return (
    <div className="w-full xl:w-[420px] bg-[#111] border-l border-[#222] flex flex-col font-mono text-xs text-gray-300 h-full overflow-y-auto">
      
      {/* Drawer Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#222] bg-[#0d0d0d]">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-white" />
          <span className="font-bold text-white tracking-wide">
            [{node.stageNumber}] {node.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="border border-[#222] hover:border-white text-gray-400 hover:text-white px-2 py-1 transition-colors text-[11px]"
        >
          ✕ CLOSE
        </button>
      </div>

      <div className="p-5 space-y-6">
        
        {/* Status & Service Banner */}
        <div className="border border-[#222] bg-[#0a0a0a] p-3 space-y-2">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500 uppercase">Status:</span>
            <span className={`font-bold uppercase ${
              node.status === 'active' ? 'text-white' : node.status === 'completed' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              ● {node.status}
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500 uppercase">Service Host:</span>
            <span className="text-gray-200">{node.service}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500 uppercase">Endpoint / Bus:</span>
            <span className="text-gray-400 font-mono">{node.portOrChannel}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-gray-500 uppercase">Tech Stack:</span>
            <span className="text-gray-300">{node.tech}</span>
          </div>
        </div>

        {/* Architectural Role */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-white font-bold tracking-wider text-[11px]">
            <Layers className="h-3.5 w-3.5 text-gray-400" />
            <span>ARCHITECTURAL ROLE</span>
          </div>
          <p className="text-gray-400 leading-relaxed bg-[#0d0d0d] p-3 border border-[#1a1a1a]">
            {node.role}
          </p>
        </div>

        {/* Why this step? Educational deep dive */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-white font-bold tracking-wider text-[11px]">
            <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
            <span>WHY THIS COMPONENT EXISTS IN MONOMELT</span>
          </div>
          <p className="text-gray-300 leading-relaxed bg-[#0a0a0a] p-3 border border-[#222] border-l-2 border-l-white">
            {node.whyThisStep}
          </p>
        </div>

        {/* Live Metrics */}
        <div>
          <div className="flex items-center gap-2 mb-2 text-white font-bold tracking-wider text-[11px]">
            <Activity className="h-3.5 w-3.5 text-gray-400" />
            <span>REAL-TIME METRICS</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(node.metrics).map(([key, val]) => (
              <div key={key} className="flex justify-between items-center bg-[#0a0a0a] p-2 border border-[#1a1a1a]">
                <span className="text-gray-500 uppercase text-[10px]">{key.replace(/_/g, ' ')}</span>
                <span className="font-bold text-white font-mono">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inspected Payload */}
        {node.activePayload && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-white font-bold tracking-wider text-[11px]">
              <Database className="h-3.5 w-3.5 text-gray-400" />
              <span>INSPECTED ACTIVE PAYLOAD</span>
            </div>
            <pre className="bg-[#050505] p-3 border border-[#222] text-[10px] text-gray-300 overflow-x-auto leading-normal">
              {JSON.stringify(node.activePayload, null, 2)}
            </pre>
          </div>
        )}

      </div>
    </div>
  );
};
