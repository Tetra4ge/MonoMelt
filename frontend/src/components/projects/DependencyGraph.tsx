import { useMemo, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useThemeStore } from '../../stores/themeStore';

interface Node {
  id: string;
  label: string;
  name: string;
  file_path?: string;
  language?: string;
  properties?: {
    loc?: number;
    symbol_type?: string | null;
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
  const isLight = useThemeStore((state) => state.theme) === 'light';
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
    // react-force-graph throws if a link references a node it does not have, so
    // drop any edge whose endpoint is outside the loaded page.
    const ids = new Set(nodes.map(n => n.id));
    return {
      nodes: nodes.map(n => ({ ...n, id: n.id })),
      links: edges
        .filter(e => ids.has(e.source_id) && ids.has(e.target_id))
        .map(e => ({ source: e.source_id, target: e.target_id, label: e.relationship }))
    };
  }, [nodes, edges]);

  // Pre-compute node to service mapping for fast lookup O(1)
  const nodeServiceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (proposedServices) {
      proposedServices.forEach((service, index) => {
        const color = SERVICE_COLORS[index % SERVICE_COLORS.length];
        (service.assigned_nodes ?? []).forEach(nodeId => {
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
      return isLight ? '#cfcfcf' : '#333333'; // Unassigned or orphaned nodes
    }

    // Default syntax coloring (symbols are tagged with their symbol_type by the API)
    if (node.label === 'File') return '#3b82f6';
    if (node.label === 'ExternalDependency') return '#6b7280';
    if (node.label === 'Symbol') {
      const type = node.properties?.symbol_type;
      if (type === 'class') return '#22c55e';
      if (type === 'function' || type === 'method') return '#ef4444';
      return '#eab308';
    }
    return '#888888';
  };

  const getNodeSize = (node: any) => {
    if (node.label === 'File') return Math.max(3, Math.min(10, (node.properties?.loc || 10) / 100));
    return 3;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full min-h-[500px] bg-[#0a0a0a] border border-[#222] rounded-none overflow-hidden relative group"
    >
      <div className="absolute top-4 left-4 z-10 p-2 bg-[#111] border border-[#222] text-xs text-gray-400 font-mono">
        {proposedServices && proposedServices.length > 0 ? (
          <>
            <div className="font-bold text-white mb-2 border-b border-[#333] pb-1">Microservices</div>
            {proposedServices.slice(0, 10).map((service, idx) => (
              <div key={service.id} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3" style={{ backgroundColor: SERVICE_COLORS[idx % SERVICE_COLORS.length] }}></div>
                {service.name}
              </div>
            ))}
            {proposedServices.length > 10 && <div className="text-gray-600 italic mt-1">+ {proposedServices.length - 10} more</div>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#3b82f6]"></div> Files</div>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#22c55e]"></div> Classes</div>
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#ef4444]"></div> Functions / methods</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#6b7280]"></div> External packages</div>
          </>
        )}
      </div>
      
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={getNodeColor}
        nodeRelSize={2}
        nodeVal={getNodeSize}
        linkColor={() => (isLight ? '#b3b3b3' : '#333333')}
        linkWidth={1}
        backgroundColor={isLight ? '#ffffff' : '#0a0a0a'}
        d3VelocityDecay={0.3} 
      />
    </div>
  );
}
