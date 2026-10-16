import React from 'react';
import type { TwinNode } from '../../types/twin.types';

interface TwinNodeCardProps {
  node: TwinNode;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (nodeId: TwinNode['id']) => void;
}

export const TwinNodeCard: React.FC<TwinNodeCardProps> = ({
  node,
  isActive,
  isSelected,
  onSelect,
}) => {
  const getStatusBorder = () => {
    if (isSelected) return 'border-white ring-1 ring-white';
    if (isActive) return 'border-white';
    if (node.status === 'completed') return 'border-[#555]';
    return 'border-[#222]';
  };

  const getStatusBadge = () => {
    if (isActive) {
      return (
        <span className="flex items-center gap-1.5 bg-white text-black px-1.5 py-0.5 text-[10px] font-bold">
          <span className="h-1.5 w-1.5 bg-black animate-ping" />
          ACTIVE
        </span>
      );
    }
    if (node.status === 'completed') {
      return (
        <span className="border border-[#444] bg-[#1a1a1a] text-gray-300 px-1.5 py-0.5 text-[10px] font-bold">
          ✓ DONE
        </span>
      );
    }
    return (
      <span className="text-gray-600 text-[10px] font-bold">
        IDLE
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelect(node.id)}
      className={`cursor-pointer transition-all bg-[#111] p-3 border font-mono text-xs select-none hover:border-[#666] ${getStatusBorder()}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-bold">[{node.stageNumber}]</span>
          <span className="font-bold text-white tracking-wide truncate max-w-[130px] sm:max-w-[180px]">
            {node.label}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Service & Port */}
      <div className="space-y-1 mb-3">
        <div className="text-[11px] text-gray-300 truncate">
          {node.service}
        </div>
        <div className="text-[10px] text-gray-500 font-mono truncate">
          {node.portOrChannel}
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 gap-1.5 bg-[#0a0a0a] p-2 border border-[#1a1a1a] text-[10px]">
        {Object.entries(node.metrics).slice(0, 2).map(([key, val]) => (
          <div key={key} className="truncate">
            <span className="text-gray-600 block truncate">{key.replace(/_/g, ' ')}:</span>
            <span className="font-bold text-gray-200">{String(val)}</span>
          </div>
        ))}
      </div>

      {/* Active Payload Peek if present */}
      {node.activePayload && isActive && (
        <div className="mt-2 text-[10px] border border-[#333] bg-[#161616] p-1.5 truncate">
          <span className="text-gray-500 mr-1">PAYLOAD:</span>
          <span className="text-white font-bold">{node.activePayload.item}</span>
        </div>
      )}

      {/* Click To Inspect Hint */}
      <div className="mt-2 text-[9px] text-right text-gray-600">
        {isSelected ? '▶ INSPECTING' : 'CLICK TO INSPECT'}
      </div>
    </div>
  );
};
