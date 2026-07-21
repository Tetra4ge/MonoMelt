/* The force-graph package exposes callback nodes as an untyped third-party shape. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Node {
  id: string;
  label: string;
  name: string;
  file_path?: string;
  language?: string;
  properties?: {
    loc?: number;
  };
}

interface Edge {
  source_id: string;
  target_id: string;
  relationship: string;
  confidence: number;
}

interface ProposedService {
  id: string;
  name: string;
  assigned_nodes: string[];
}

interface DependencyGraphProps {
  nodes: Node[];
  edges: Edge[];
  proposedServices?: ProposedService[];
}

// Generate distinct colors for services
const SERVICE_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#8b5cf6', // violet
  '#14b8a6', // teal
];

export default function DependencyGraph({ nodes, edges, proposedServices }: DependencyGraphProps) {
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const graphData = useMemo(() => {
    return {
      nodes: nodes.map(n => ({ ...n, id: n.id })),
      links: edges.map(e => ({ source: e.source_id, target: e.target_id, label: e.relationship }))
    };
  }, [nodes, edges]);

  // Pre-compute node to service mapping for fast lookup O(1)
  const nodeServiceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (proposedServices) {
      proposedServices.forEach((service, index) => {
        const color = SERVICE_COLORS[index % SERVICE_COLORS.length];
        service.assigned_nodes.forEach(nodeId => {
          map.set(nodeId, color);
        });
      });
    }
    return map;
  }, [proposedServices]);

  const getNodeColor = (node: any) => {
    // If we have proposed services, color by service boundary
    if (proposedServices && proposedServices.length > 0) {
      const serviceColor = nodeServiceMap.get(node.id);
      if (serviceColor) return serviceColor;
      return '#333333'; // Unassigned or orphaned nodes
    }

    // Syntax & Entity type coloring matching the Legend
    if (node.label === 'File') return '#3b82f6'; // Blue for Files
    if (node.label === 'Class') return '#22c55e'; // Green for Classes
    if (node.label === 'Symbol') return '#eab308'; // Yellow for Symbols/Functions
    if (node.label === 'ExternalDependency') return '#64748b'; // Slate Grey for External Dependencies
    return '#94a3b8';
  };

  const getNodeSize = (node: any) => {
    if (node.label === 'File') return Math.max(4, Math.min(10, (node.properties?.loc || 10) / 80));
    if (node.label === 'ExternalDependency') return 3;
    return 4;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full min-h-[500px] bg-[#0a0a0a] border border-[#222] rounded-none overflow-hidden relative group"
    >
      <div className="absolute top-4 left-4 z-10 p-3 bg-[#111]/90 backdrop-blur-sm border border-[#222] text-xs text-gray-300 font-mono shadow-xl rounded-sm">
        {proposedServices && proposedServices.length > 0 ? (
          <>
            <div className="font-bold text-white mb-2 border-b border-[#333] pb-1 text-[11px] uppercase tracking-wider">Microservice Clusters</div>
            {proposedServices.slice(0, 10).map((service, idx) => (
              <div key={service.id} className="flex items-center gap-2 mb-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length] }}></div>
                <span className="font-medium text-white">{service.name}</span>
              </div>
            ))}
            {proposedServices.length > 10 && <div className="text-gray-500 italic mt-1 text-[10px]">+ {proposedServices.length - 10} more services</div>}
          </>
        ) : (
          <>
            <div className="font-bold text-white mb-2 border-b border-[#222] pb-1 text-[11px] uppercase tracking-wider">Graph Legend</div>
            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div> Files (Modules)</div>
            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-[#eab308]"></div> Functions & Symbols</div>
            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-[#64748b]"></div> External Dependencies</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]"></div> Classes & Types</div>
          </>
        )}
      </div>
      
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel={(n: any) => `${n.label || 'Entity'}: ${n.name || n.file_path || n.id}`}
        nodeColor={getNodeColor}
        nodeRelSize={2.5}
        nodeVal={getNodeSize}
        linkColor={() => '#334155'}
        linkWidth={1.2}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.006}
        backgroundColor="#0a0a0a"
        d3VelocityDecay={0.3} 
      />
    </div>
  );
}
