import React from 'react';
import type { TwinNode, TwinStageId } from '../../types/twin.types';
import { TwinNodeCard } from './TwinNodeCard';

interface PipelineCanvasProps {
  nodes: Record<TwinStageId, TwinNode>;
  activeStage: TwinStageId | null;
  activePacket: { from: TwinStageId; to: TwinStageId; label: string } | null;
  selectedNodeId: TwinStageId | null;
  onSelectNode: (id: TwinStageId) => void;
}

const STAGES_ORDER: TwinStageId[] = [
  'ingestion',
  'redis_queue',
  'worker_engine',
  'tree_sitter',
  'neo4j_graph',
  'decomposition',
  'mcp_export',
];

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({
  nodes,
  activeStage,
  activePacket,
  selectedNodeId,
  onSelectNode,
}) => {
  return (
    <div className="flex-1 bg-[#0a0a0a] p-4 sm:p-6 overflow-y-auto font-mono">
      
      {/* Top Architecture Banner */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border border-[#222] bg-[#111] p-3 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="font-bold text-white">&gt; TOPOLOGY:</span>
          <span>7-STAGE ASYNCHRONOUS DECOMPOSITION PIPELINE</span>
        </div>
        {activePacket && (
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] px-2 py-1 text-[11px] text-gray-300">
            <span className="text-white font-bold animate-pulse">◆ IN TRANSIT:</span>
            <span className="font-mono text-gray-400">{activePacket.label}</span>
            <span className="text-gray-600">[{activePacket.from} → {activePacket.to}]</span>
          </div>
        )}
      </div>

      {/* Responsive Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {STAGES_ORDER.map((stageId, index) => {
          const node = nodes[stageId];
          const isActive = activeStage === stageId;
          const isSelected = selectedNodeId === stageId;
          const hasNext = index < STAGES_ORDER.length - 1;

          return (
            <div key={stageId} className="relative flex flex-col justify-between">
              <TwinNodeCard
                node={node}
                isActive={isActive}
                isSelected={isSelected}
                onSelect={onSelectNode}
              />
              {/* Connector indicator for layout */}
              {hasNext && (
                <div className="hidden xl:flex items-center justify-center py-1 text-gray-600">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="h-px w-6 bg-[#222]" />
                    <span className={activePacket?.from === stageId ? 'text-white font-bold animate-pulse' : 'text-gray-600'}>
                      {activePacket?.from === stageId ? '◆ PACKET' : '→'}
                    </span>
                    <span className="h-px w-6 bg-[#222]" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Architectural Flow Legend */}
      <div className="mt-8 border-t border-[#222] pt-4 text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-white bg-white" />
            <span className="text-gray-400">ACTIVE EXECUTION</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-[#555] bg-[#1a1a1a]" />
            <span className="text-gray-400">COMPLETED STAGE</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 border border-[#222] bg-[#111]" />
            <span className="text-gray-400">IDLE / STANDBY</span>
          </span>
        </div>
        <div className="text-gray-600">
          NODE ISOLATION: FAULT-TOLERANT EVENT-DRIVEN BUS
        </div>
      </div>

    </div>
  );
};
