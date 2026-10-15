import { useState, useEffect, useRef, useCallback } from 'react';
import type { TwinStageId, TwinNode, TwinLog, TwinSimulationStep } from '../types/twin.types';
import api from '../lib/api';

const DEFAULT_NODES: Record<TwinStageId, TwinNode> = {
  ingestion: {
    id: 'ingestion',
    stageNumber: '01',
    label: 'INGESTION_GATEWAY',
    service: 'API Gateway / Express',
    status: 'idle',
    tech: 'Node.js 20, Multer, Stream Router',
    portOrChannel: ':5000 / POST /api/projects',
    role: 'Validates archive signatures, extracts file trees into isolated sandboxes, and verifies language manifest.',
    whyThisStep: 'Prevents corrupt, oversized, or malicious files from flooding AST parsers. Ensures safe file system extraction.',
    metrics: { files_received: 0, payload_mb: '0.0 MB', valid_signatures: 'OK' },
  },
  redis_queue: {
    id: 'redis_queue',
    stageNumber: '02',
    label: 'MESSAGE_BUS_REDIS',
    service: 'Redis Queue Engine',
    status: 'idle',
    tech: 'Redis 7.2 Alpine, BullMQ Engine',
    portOrChannel: ':6379 [analysis_jobs]',
    role: 'Enqueues analysis jobs with unique IDs, manages backpressure, and decouples HTTP gateway from heavy worker compute.',
    whyThisStep: 'Codebase parsing is CPU-intensive. Without an asynchronous queue, HTTP requests would timeout and exhaust memory.',
    metrics: { pending_jobs: 0, queue_latency: '1.2ms', memory_used: '14.2 MB' },
  },
  worker_engine: {
    id: 'worker_engine',
    stageNumber: '03',
    label: 'WORKER_COORDINATOR',
    service: 'FastAPI Analysis Worker',
    status: 'idle',
    tech: 'Python 3.11, Uvicorn, AsyncIO',
    portOrChannel: ':8000 /worker/task',
    role: 'Pulls job from Redis, acquires cluster lock, provisions temporary parsing scratchpad, and dispatches language parsers.',
    whyThisStep: 'Worker isolation ensures an AST syntax error or exotic dependency in one file never crashes the central API gateway.',
    metrics: { worker_id: 'proc_01', active_threads: 4, cpu_load: '8.4%' },
  },
  tree_sitter: {
    id: 'tree_sitter',
    stageNumber: '04',
    label: 'TREE_SITTER_AST',
    service: 'Polyglot Grammar Engine',
    status: 'idle',
    tech: 'Tree-Sitter C-Bindings (Java/Py/TS/Go)',
    portOrChannel: 'native_ffi_binding',
    role: 'Traverses CST & AST trees to identify class hierarchies, function definitions, decorators, call sites, and import paths.',
    whyThisStep: 'Regex cannot reliably parse nested class scopes, polymorphic inheritance, or dynamic imports. ASTs are deterministic.',
    metrics: { parsed_files: 0, ast_nodes: 0, syntax_errors: 0 },
  },
  neo4j_graph: {
    id: 'neo4j_graph',
    stageNumber: '05',
    label: 'NEO4J_TOPOLOGY',
    service: 'Neo4j Graph Database',
    status: 'idle',
    tech: 'Neo4j 5.15 Community, Cypher, Bolt',
    portOrChannel: ':7687 bolt://localhost',
    role: 'Transforms AST outputs into (Class)-[:CALLS]->(Class) and (Service)-[:DEPENDS_ON]->(Entity) queryable graph topologies.',
    whyThisStep: 'Relational SQL cannot traverse multi-hop circular dependencies or variable-depth call paths across 100+ classes efficiently.',
    metrics: { graph_nodes: 0, call_edges: 0, graph_density: '0.00' },
  },
  decomposition: {
    id: 'decomposition',
    stageNumber: '06',
    label: 'DECOMPOSITION_AI',
    service: 'Louvain & Girvan-Newman Engine',
    status: 'idle',
    tech: 'NetworkX, Louvain Modularity, OpenRouter',
    portOrChannel: 'internal_algo_pipeline',
    role: 'Executes community detection algorithms, isolates bounded contexts, and identifies candidate microservices with low coupling.',
    whyThisStep: 'Automatically finds natural domain seams so refactoring teams minimize expensive synchronous network calls across new services.',
    metrics: { clusters_found: 0, modularity_q: '0.00', decoupled_ratio: '0%' },
  },
  mcp_export: {
    id: 'mcp_export',
    stageNumber: '07',
    label: 'MCP_SYNCHRONIZER',
    service: 'Model Context Protocol Bridge',
    status: 'idle',
    tech: 'MCP Specification, Notion API, Docker',
    portOrChannel: ':5000/api/reports/mcp',
    role: 'Compiles extracted microservice blueprints, synthesizes migration roadmap, and synchronizes living docs to Notion via MCP.',
    whyThisStep: 'Analysis must be immediately operationalized into engineering sprint tickets, Docker configurations, and architecture docs.',
    metrics: { blueprints_ready: 0, notion_pages: 0, target_services: 0 },
  },
};

const SIMULATION_STEPS: TwinSimulationStep[] = [
  {
    stageId: 'ingestion',
    duration: 1800,
    log: '[GATEWAY] Received archive stream "monolith_backend.zip" (24.8 MB). Validating checksum...',
    packetLabel: 'RAW_ARCHIVE.ZIP',
    metricsUpdate: { files_received: 48, payload_mb: '24.8 MB', valid_signatures: 'SHA256_VERIFIED' },
    activePayload: { item: 'monolith_backend.zip', type: 'application/zip', size: '24.8 MB' },
  },
  {
    stageId: 'redis_queue',
    duration: 1400,
    log: '[REDIS] Enqueued Job "job_a8f9c1" into queue "analysis_jobs". Priority: HIGH. Ready for worker claim.',
    packetLabel: 'JOB_PAYLOAD::a8f9c1',
    metricsUpdate: { pending_jobs: 1, queue_latency: '0.8ms', memory_used: '15.4 MB' },
    activePayload: { item: 'job_a8f9c1', type: 'QueueMessage', size: '1.2 KB' },
  },
  {
    stageId: 'worker_engine',
    duration: 1600,
    log: '[WORKER] Worker-01 claimed "job_a8f9c1". Sandboxed in /tmp/monomelt/a8f9c1. Detected Polyglot: Java (70%), TS (30%).',
    packetLabel: 'JOB_CLAIM_LOCK',
    metricsUpdate: { worker_id: 'proc_01', active_threads: 4, cpu_load: '38.2%' },
    activePayload: { item: 'WorkspaceDirectory', type: 'DirectorySandbox', size: '48 files' },
  },
  {
    stageId: 'tree_sitter',
    duration: 2400,
    log: '[TREE-SITTER] Parsing AST: OrderController.java, PaymentService.java, UserRepository.java, AuthToken.ts...',
    packetLabel: 'AST_SYNTAX_NODES',
    metricsUpdate: { parsed_files: 48, ast_nodes: 4280, syntax_errors: 0 },
    activePayload: { item: 'AST::ClassDeclaration', type: 'SyntaxTree', size: '4,280 nodes' },
  },
  {
    stageId: 'neo4j_graph',
    duration: 2200,
    log: '[NEO4J] Bolt transaction committed: Ingested 48 Class nodes, 184 CALLS edges, 62 IMPORTS relationships.',
    packetLabel: 'GRAPH_TRIPLES',
    metricsUpdate: { graph_nodes: 48, call_edges: 184, graph_density: '0.14' },
    activePayload: { item: 'CypherSubGraph', type: 'DirectedGraph', size: '184 edges' },
  },
  {
    stageId: 'decomposition',
    duration: 2200,
    log: '[DECOMPOSITION] Louvain community detection converged (Q=0.68). Extracted 3 bounded contexts: OrderService, AuthService, PaymentService.',
    packetLabel: 'CLUSTER_BOUNDARIES',
    metricsUpdate: { clusters_found: 3, modularity_q: '0.68', decoupled_ratio: '88%' },
    activePayload: { item: 'ServiceBoundaries[3]', type: 'DomainClusters', size: '3 clusters' },
  },
  {
    stageId: 'mcp_export',
    duration: 2000,
    log: '[MCP] Living architecture synced to Notion MCP Server. Migration roadmap & Docker Compose blueprints ready.',
    packetLabel: 'NOTION_MCP_PAYLOAD',
    metricsUpdate: { blueprints_ready: 3, notion_pages: 1, target_services: 3 },
    activePayload: { item: 'NotionArchitecturePage', type: 'MCP_Document', size: 'Synced' },
  },
];

export function useTwinEngine(projectId?: string) {
  const [nodes, setNodes] = useState<Record<TwinStageId, TwinNode>>(DEFAULT_NODES);
  const [activeStage, setActiveStage] = useState<TwinStageId | null>(null);
  const [activePacket, setActivePacket] = useState<{ from: TwinStageId; to: TwinStageId; label: string } | null>(null);
  const [logs, setLogs] = useState<TwinLog[]>([
    {
      id: 'init-0',
      timestamp: new Date().toLocaleTimeString(),
      stageId: 'ingestion',
      level: 'INFO',
      message: 'MonoMelt Observatory Initialized. Standby for live telemetry or simulation dispatch.',
    },
  ]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1);
  const [mode, setMode] = useState<'live' | 'simulation'>('simulation');
  const [progress, setProgress] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<TwinStageId | null>('ingestion');

  const simStepIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to append log
  const addLog = useCallback((stageId: TwinStageId, level: TwinLog['level'], message: string) => {
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toLocaleTimeString(),
        stageId,
        level,
        message,
      },
      ...prev.slice(0, 99), // keep last 100
    ]);
  }, []);

  // Reset all nodes to idle
  const resetEngine = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(false);
    setIsPaused(false);
    setActiveStage(null);
    setActivePacket(null);
    setProgress(0);
    simStepIndexRef.current = 0;
    setNodes(DEFAULT_NODES);
    addLog('ingestion', 'INFO', 'Engine reset. All nodes returned to idle state.');
  }, [addLog]);

  // Execute single simulation step
  const executeSimulationStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= SIMULATION_STEPS.length) {
        setIsSimulating(false);
        setActiveStage(null);
        setActivePacket(null);
        setProgress(100);
        addLog('mcp_export', 'DONE', '✓ Pipeline run complete. Monolith transformed into 3 microservices.');
        return;
      }

      const step = SIMULATION_STEPS[stepIndex];
      simStepIndexRef.current = stepIndex;
      setActiveStage(step.stageId);
      setProgress(Math.round(((stepIndex + 1) / SIMULATION_STEPS.length) * 100));

      // Packet animation to next node if available
      const nextStep = SIMULATION_STEPS[stepIndex + 1];
      if (nextStep) {
        setActivePacket({
          from: step.stageId,
          to: nextStep.stageId,
          label: step.packetLabel,
        });
      } else {
        setActivePacket(null);
      }

      // Update node status
      setNodes((prev) => {
        const updated = { ...prev };
        // Mark previous as completed
        Object.keys(updated).forEach((k) => {
          const key = k as TwinStageId;
          if (updated[key].status === 'active') {
            updated[key] = { ...updated[key], status: 'completed' };
          }
        });
        // Mark current as active
        updated[step.stageId] = {
          ...updated[step.stageId],
          status: 'active',
          metrics: { ...updated[step.stageId].metrics, ...(step.metricsUpdate as Record<string, string | number>) },
          activePayload: step.activePayload,
        };
        return updated;
      });

      addLog(step.stageId, 'EXEC', step.log);

      // Schedule next step
      const stepDuration = Math.max(400, step.duration / simSpeed);
      timerRef.current = setTimeout(() => {
        executeSimulationStep(stepIndex + 1);
      }, stepDuration);
    },
    [addLog, simSpeed]
  );

  // Play / Start simulation
  const startSimulation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(true);
    setIsPaused(false);
    addLog('ingestion', 'INFO', `Starting simulation execution (${simSpeed}x speed)...`);
    executeSimulationStep(simStepIndexRef.current);
  }, [addLog, executeSimulationStep, simSpeed]);

  // Pause simulation
  const pauseSimulation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPaused(true);
    setIsSimulating(false);
    addLog(activeStage || 'ingestion', 'WARN', 'Simulation paused by user.');
  }, [activeStage, addLog]);

  // Resume simulation
  const resumeSimulation = useCallback(() => {
    setIsSimulating(true);
    setIsPaused(false);
    addLog(activeStage || 'ingestion', 'INFO', 'Resuming simulation...');
    executeSimulationStep(simStepIndexRef.current);
  }, [activeStage, addLog, executeSimulationStep]);

  // Step forward single stage
  const stepForward = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(false);
    setIsPaused(true);
    const nextIdx = (simStepIndexRef.current + 1) % SIMULATION_STEPS.length;
    executeSimulationStep(nextIdx);
  }, [executeSimulationStep]);

  // Live polling for real project if projectId exists and in live mode
  useEffect(() => {
    if (mode !== 'live' || !projectId) return;

    let isSubscribed = true;
    const fetchLiveProjectData = async () => {
      try {
        const res = await api.get(`/api/analysis/${projectId}`);
        if (!isSubscribed) return;
        const job = res.data?.data;
        if (job) {
          const status = job.status;
          addLog('ingestion', 'INFO', `[LIVE TELEMETRY] Job status: ${status}`);
          if (status === 'completed') {
            setNodes((prev) => {
              const updated = { ...prev };
              Object.keys(updated).forEach((k) => {
                updated[k as TwinStageId] = { ...updated[k as TwinStageId], status: 'completed' };
              });
              return updated;
            });
            setProgress(100);
          } else if (status === 'processing') {
            setActiveStage('tree_sitter');
            setNodes((prev) => ({
              ...prev,
              ingestion: { ...prev.ingestion, status: 'completed' },
              redis_queue: { ...prev.redis_queue, status: 'completed' },
              worker_engine: { ...prev.worker_engine, status: 'completed' },
              tree_sitter: { ...prev.tree_sitter, status: 'active' },
            }));
            setProgress(50);
          }
        }
      } catch {
        // Fallback or quiet retry
      }
    };

    fetchLiveProjectData();
    const interval = setInterval(fetchLiveProjectData, 4000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [mode, projectId, addLog]);

  return {
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
  };
}
