import { useParams, Link } from 'react-router-dom';
import { Terminal, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTwinEngine } from '../hooks/useTwinEngine';
import { TwinHeader } from '../components/twin/TwinHeader';
import { PipelineCanvas } from '../components/twin/PipelineCanvas';
import { NodeDetailDrawer } from '../components/twin/NodeDetailDrawer';
import { TwinLogStream } from '../components/twin/TwinLogStream';

export default function TwinPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { signOut } = useAuthStore();

  const {
    nodes,
    activeStage,
    activePacket,
    logs,
    isSimulating,
    isPaused,
    simSpeed,
    mode,
    progress,
    selectedNodeId,
    setMode,
    setSimSpeed,
    setSelectedNodeId,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stepForward,
    resetEngine,
  } = useTwinEngine(projectId);

  const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-300 font-mono flex flex-col">
      
      {/* Top Global Navigation Bar */}
      <header className="border-b border-[#222] bg-[#0d0d0d] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & Project Breadcrumb */}
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-white shrink-0" />
          <Link to="/dashboard">
            <span className="text-xl font-logo tracking-widest text-gray-200 hover:text-white cursor-pointer">
              monomelt
            </span>
          </Link>
          <span className="text-gray-600 text-sm">/</span>
          <span className="text-white text-xs font-bold tracking-widest">
            DIGITAL_TWIN
          </span>
          {projectId && (
            <span className="hidden sm:inline text-gray-500 text-xs">
              [{projectId.slice(0, 8)}]
            </span>
          )}
        </div>

        {/* Project View Tabs */}
        {projectId && (
          <nav className="flex items-center gap-1 border border-[#222] bg-[#111] p-0.5 text-xs">
            <Link
              to={`/dashboard/projects/${projectId}/analysis`}
              className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
            >
              ANALYSIS
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/planning`}
              className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
            >
              PLANNING
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/export`}
              className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
            >
              EXPORT
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/report`}
              className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
            >
              REPORT
            </Link>
            <span className="bg-white text-black font-bold px-3 py-1">
              OBSERVATORY
            </span>
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-xs border border-[#222] bg-[#111] px-3 py-1.5 text-gray-400 hover:border-white hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DASHBOARD</span>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-xs border border-[#222] bg-[#111] px-3 py-1.5 text-gray-400 hover:border-white hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXIT</span>
          </button>
        </div>
      </header>

      {/* Control & HUD Status Subheader */}
      <TwinHeader
        projectId={projectId}
        mode={mode}
        isSimulating={isSimulating}
        isPaused={isPaused}
        simSpeed={simSpeed}
        progress={progress}
        onModeChange={setMode}
        onPlay={isPaused ? resumeSimulation : startSimulation}
        onPause={pauseSimulation}
        onStep={stepForward}
        onReset={resetEngine}
        onSpeedChange={setSimSpeed}
      />

      {/* Main Observatory Body: Canvas + Drawer */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden relative min-h-[460px]">
        <PipelineCanvas
          nodes={nodes}
          activeStage={activeStage}
          activePacket={activePacket}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => setSelectedNodeId(id)}
        />

        {selectedNode && (
          <NodeDetailDrawer
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Bottom Terminal Event Stream */}
      <TwinLogStream logs={logs} />

    </main>
  );
}
