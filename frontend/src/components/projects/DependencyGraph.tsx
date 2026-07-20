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

interface DependencyGraphProps {
  nodes: Node[];
  edges: Edge[];
}

export default function DependencyGraph({ nodes, edges }: DependencyGraphProps) {
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
    // Map edges to use standard object references required by ForceGraph
    return {
      nodes: nodes.map(n => ({ ...n, id: n.id })), // Ensure distinct instances
      links: edges.map(e => ({ source: e.source_id, target: e.target_id, label: e.relationship }))
    };
  }, [nodes, edges]);

  // Node Color Mapper based on User's explicit instructions (Files = blue, Classes = green, Functions = red)
  const getNodeColor = (node: any) => {
    if (node.label === 'File') return '#3b82f6';
    if (node.label === 'Class') return '#22c55e';
    if (node.label === 'Symbol' && node.properties?.symbol_type === 'function') return '#ef4444';
    if (node.label === 'Symbol') return '#eab308'; // Other symbols yellow
    return '#888888'; // Default grey for Externals
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
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#3b82f6]"></div> Files</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-[#22c55e]"></div> Classes</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ef4444]"></div> Functions</div>
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
        linkColor={() => '#333333'}
        linkWidth={1}
        backgroundColor="#0a0a0a"
        d3VelocityDecay={0.3} // Make the graph settle faster
      />
    </div>
  );
}
