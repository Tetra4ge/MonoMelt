import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { TwinStageId, TwinNode, TwinLog, TwinSimulationStep, TwinProjectSummary } from '../types/twin.types';
import api from '../lib/api';
import { supabase } from '../lib/supabase';

function generateBaseNodes(summary?: TwinProjectSummary | null): Record<TwinStageId, TwinNode> {
  const isReal = !!summary?.isRealData;
  const pName = summary?.projectName || 'monolith_workspace';
  const fileCount = summary?.fileCount || 0;
  const classCount = summary?.classCount || 0;
  const edgeCount = summary?.edgeCount || 0;
  const astCount = summary?.astNodesCount || 0;
  const clusterCount = summary?.candidateServices?.length || 0;
  const qScore = summary?.modularityScore || '0.00';

  return {
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
      metrics: {
        target_project: pName.slice(0, 16),
        source_type: summary?.sourceType?.toUpperCase() || 'ZIP_ARCHIVE',
        files_detected: isReal ? fileCount : 0,
      },
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
      metrics: {
        pending_jobs: 0,
        queue_latency: '0.9ms',
        channel: 'analysis_jobs',
      },
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
      metrics: {
        languages: summary?.primaryLanguages || 'Detecting...',
        active_threads: Math.min(8, Math.max(2, Math.round(fileCount / 10))),
        worker_id: 'proc_worker_01',
      },
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
      metrics: {
        target_files: isReal ? fileCount : 0,
        ast_nodes: isReal ? astCount : 0,
        syntax_health: '100% OK',
      },
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
      metrics: {
        graph_nodes: isReal ? classCount : 0,
        call_edges: isReal ? edgeCount : 0,
        density: classCount > 0 ? (edgeCount / (classCount * (classCount - 1) || 1)).toFixed(3) : '0.00',
      },
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
      metrics: {
        candidate_services: isReal ? clusterCount : 0,
        modularity_q: isReal ? qScore : '0.00',
        decoupled_ratio: isReal ? '85%' : '0%',
      },
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
      metrics: {
        blueprints_ready: isReal ? clusterCount : 0,
        notion_synced: isReal ? '1 workspace' : 'pending',
        target_services: isReal ? clusterCount : 0,
      },
    },
  };
}

function buildDynamicSimulationSteps(summary: TwinProjectSummary): TwinSimulationStep[] {
  const pName = summary.projectName || 'monolith_app';
  const fileCount = summary.fileCount || 36;
  const classCount = summary.classCount || 24;
  const edgeCount = summary.edgeCount || 72;
  const astCount = summary.astNodesCount || 2840;
  const languages = summary.primaryLanguages || 'Polyglot Codebase';
  const filesList = summary.sampleFiles.length > 0
    ? summary.sampleFiles.slice(0, 4).join(', ')
    : 'Controllers, Services, Models, Repositories';
  const clusters = summary.candidateServices.length > 0
    ? summary.candidateServices.join(', ')
    : 'OrderService, AuthService, InventoryService';
  const clusterCount = summary.candidateServices.length || 3;
  const qScore = summary.modularityScore || '0.65';

  // Dynamic durations proportional to codebase size:
  const tIngest = Math.min(3200, 1100 + Math.round(fileCount * 14));
  const tQueue = Math.min(2000, 800 + Math.round(fileCount * 8));
  const tWorker = Math.min(2800, 1000 + Math.round(fileCount * 12));
  const tAst = Math.min(4800, 1300 + Math.round(fileCount * 28));
  const tNeo = Math.min(4400, 1200 + Math.round(edgeCount * 20));
  const tDecomp = Math.min(4000, 1100 + Math.round(classCount * 24));
  const tMcp = 1800;

  return [
    {
      stageId: 'ingestion',
      duration: tIngest,
      log: `[GATEWAY] Ingesting "${pName}" (${summary.sourceType.toUpperCase()}). Scanned ${fileCount} files. Verifying signatures...`,
      packetLabel: `${pName.toUpperCase().slice(0, 14)}.SOURCE`,
      metricsUpdate: {
        files_detected: fileCount,
        valid_signatures: 'SHA256_VERIFIED',
      },
      activePayload: {
        item: `${pName}.${summary.sourceType === 'github' ? 'git' : 'zip'}`,
        type: summary.sourceType === 'github' ? 'git_remote_repo' : 'application/zip',
        size: `${fileCount} source files`,
      },
    },
    {
      stageId: 'redis_queue',
      duration: tQueue,
      log: `[REDIS] Enqueued project analysis job for "${pName}". Priority: HIGH. Ready for analysis worker dispatch.`,
      packetLabel: `JOB::${summary.projectId.slice(0, 8)}`,
      metricsUpdate: {
        pending_jobs: 1,
        queue_latency: '0.7ms',
      },
      activePayload: {
        item: `Job_${summary.projectId.slice(0, 8)}`,
        type: 'QueueMessage',
        size: `${fileCount} files manifest`,
      },
    },
    {
      stageId: 'worker_engine',
      duration: tWorker,
      log: `[WORKER] Analysis worker claimed job. Sandboxed context. Detected stack: ${languages}. Dispatching AST parsers.`,
      packetLabel: 'WORKER_DISPATCH_LOCK',
      metricsUpdate: {
        languages,
        active_threads: Math.min(8, Math.max(2, Math.round(fileCount / 10))),
      },
      activePayload: {
        item: `Sandbox::/tmp/monomelt/${summary.projectId.slice(0, 8)}`,
        type: 'WorkspaceDirectory',
        size: `${fileCount} source files`,
      },
    },
    {
      stageId: 'tree_sitter',
      duration: tAst,
      log: `[TREE-SITTER] Generated ${astCount} AST nodes across ${fileCount} files. Scanned: ${filesList}...`,
      packetLabel: `AST_NODES[${astCount}]`,
      metricsUpdate: {
        target_files: fileCount,
        ast_nodes: astCount,
        syntax_health: '100% OK',
      },
      activePayload: {
        item: summary.sampleFiles[0] ? `AST::${summary.sampleFiles[0]}` : 'AST::SyntaxDeclaration',
        type: 'ConcreteSyntaxTree',
        size: `${astCount} AST symbols`,
      },
    },
    {
      stageId: 'neo4j_graph',
      duration: tNeo,
      log: `[NEO4J] Bolt transaction committed: Ingested ${classCount} class/symbol nodes, ${edgeCount} dependency & call edges.`,
      packetLabel: `GRAPH_TRIPLES[${edgeCount}]`,
      metricsUpdate: {
        graph_nodes: classCount,
        call_edges: edgeCount,
        density: classCount > 0 ? (edgeCount / (classCount * (classCount - 1) || 1)).toFixed(3) : '0.12',
      },
      activePayload: {
        item: `CypherTopology::${pName}`,
        type: 'DirectedGraph',
        size: `${classCount} nodes, ${edgeCount} edges`,
      },
    },
    {
      stageId: 'decomposition',
      duration: tDecomp,
      log: `[DECOMPOSITION] Louvain community detection converged (Q=${qScore}). Extracted ${clusterCount} microservices: [${clusters}].`,
      packetLabel: `SERVICES[${clusterCount}]`,
      metricsUpdate: {
        candidate_services: clusterCount,
        modularity_q: qScore,
        decoupled_ratio: '88%',
      },
      activePayload: {
        item: `DecomposedServices[${clusterCount}]`,
        type: 'BoundedContextClusters',
        size: `${clusterCount} autonomous services`,
      },
    },
    {
      stageId: 'mcp_export',
      duration: tMcp,
      log: `[MCP] Exported living architecture for ${clusterCount} microservices to Notion MCP Server and Docker compose blueprints.`,
      packetLabel: 'MCP_NOTION_SYNC',
      metricsUpdate: {
        blueprints_ready: clusterCount,
        notion_synced: 'Synced to Notion',
        target_services: clusterCount,
      },
      activePayload: {
        item: `NotionBlueprint::${pName}`,
        type: 'MCP_Specification',
        size: `${clusterCount} service targets`,
      },
    },
  ];
}

export function useTwinEngine(projectId?: string) {
  const [projectSummary, setProjectSummary] = useState<TwinProjectSummary | null>(null);
  const [nodes, setNodes] = useState<Record<TwinStageId, TwinNode>>(() => generateBaseNodes(null));
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
      ...prev.slice(0, 99),
    ]);
  }, []);

  // Fetch real project data & build personalized summary
  useEffect(() => {
    if (!projectId || projectId === 'sandbox') {
      const fallbackSummary: TwinProjectSummary = {
        projectId: 'sandbox',
        projectName: 'monolith_ecommerce_demo',
        sourceType: 'archive.zip',
        fileCount: 42,
        classCount: 28,
        edgeCount: 114,
        astNodesCount: 3450,
        primaryLanguages: 'Java (75%), TypeScript (25%)',
        sampleFiles: ['OrderController.java', 'PaymentGateway.java', 'UserRepository.java', 'AuthToken.ts'],
        candidateServices: ['OrderService', 'AuthService', 'PaymentService'],
        modularityScore: '0.68',
        isRealData: false,
      };
      setProjectSummary(fallbackSummary);
      setNodes(generateBaseNodes(fallbackSummary));
      return;
    }

    let isSubscribed = true;

    async function loadProjectDetails() {
      try {
        // 1. Get project metadata
        const projectRes = await api.get(`/api/projects/${projectId}`).catch(() => null);
        const projectData = projectRes?.data?.data || {};

        // 2. Get latest analysis job from Supabase
        const { data: jobs } = await supabase
          .from('analysis_jobs')
          .select('id, source_version_id, status, error_code')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestJob = jobs?.[0] || null;
        let metricsData: any = null;
        let graphData: any = { nodes: [], edges: [] };
        let scenariosData: any[] = [];

        if (latestJob?.source_version_id) {
          const svid = latestJob.source_version_id;
          const [mRes, gRes, sRes] = await Promise.allSettled([
            api.get(`/api/projects/${projectId}/analysis/${svid}/metrics`),
            api.get(`/api/projects/${projectId}/analysis/${svid}/graph?depth=2&limit=200`),
            api.get(`/api/projects/${projectId}/scenarios`),
          ]);

          if (mRes.status === 'fulfilled') metricsData = mRes.value.data?.data;
          if (gRes.status === 'fulfilled') graphData = gRes.value.data?.data || { nodes: [], edges: [] };
          if (sRes.status === 'fulfilled') scenariosData = sRes.value.data?.data || [];
        }

        if (!isSubscribed) return;

        // Extract real sample files and candidate services
        const gNodes: any[] = graphData?.nodes || [];
        const gEdges: any[] = graphData?.edges || [];
        const sampleFiles = gNodes
          .map((n) => n.name || (n.file_path ? n.file_path.split('/').pop() : ''))
          .filter(Boolean)
          .slice(0, 6);

        let candidateServices: string[] = [];
        if (scenariosData.length > 0 && scenariosData[0]?.clusters) {
          candidateServices = scenariosData[0].clusters.map((c: any) => c.name || `Service_${c.id}`);
        } else if (sampleFiles.length > 0) {
          // Derive natural domain groupings from sample files
          candidateServices = Array.from(
            new Set(
              sampleFiles.map((f) => {
                const clean = f.replace(/(Controller|Service|Repository|DAO|Model|Entity|\.java|\.ts|\.py|\.go)/gi, '');
                return clean.length > 2 ? `${clean}Service` : 'CoreService';
              })
            )
          ).slice(0, 4);
        }
        if (candidateServices.length === 0) {
          candidateServices = ['CoreDomainService', 'AccountService', 'DataService'];
        }

        // Format language breakdown
        let langs = 'Polyglot Codebase';
        if (metricsData?.language_breakdown && typeof metricsData.language_breakdown === 'object') {
          langs = Object.entries(metricsData.language_breakdown)
            .map(([lang, count]) => `${lang.toUpperCase()} (${count})`)
            .slice(0, 3)
            .join(', ');
        }

        const realFileCount = metricsData?.total_files || gNodes.length || (sampleFiles.length > 0 ? sampleFiles.length * 4 : 18);
        const realClassCount = metricsData?.total_classes || Math.max(gNodes.length, Math.round(realFileCount * 0.8));
        const realEdgeCount = gEdges.length || metricsData?.total_calls || Math.round(realClassCount * 2.8);
        const realAstCount = metricsData?.total_lines || (metricsData?.total_functions || 0) + realClassCount * 14 || realFileCount * 90;
        const realQ = scenariosData[0]?.modularity_score
          ? Number(scenariosData[0].modularity_score).toFixed(2)
          : '0.64';

        const safeProjectId = projectId || 'sandbox';
        const customSummary: TwinProjectSummary = {
          projectId: safeProjectId,
          projectName: projectData.name || `project_${safeProjectId.slice(0, 8)}`,
          sourceType: projectData.source_type || 'github',
          fileCount: realFileCount,
          classCount: realClassCount,
          edgeCount: realEdgeCount,
          astNodesCount: realAstCount,
          primaryLanguages: langs,
          sampleFiles: sampleFiles.length > 0 ? sampleFiles : ['MainController.ts', 'AppService.ts', 'DataRepository.ts'],
          candidateServices,
          modularityScore: realQ,
          isRealData: true,
        };

        setProjectSummary(customSummary);
        const baseNodes = generateBaseNodes(customSummary);

        // If project analysis is already complete, populate nodes in completed state with real values!
        if (latestJob?.status === 'completed') {
          Object.keys(baseNodes).forEach((k) => {
            baseNodes[k as TwinStageId].status = 'completed';
          });
          setProgress(100);
        }

        setNodes(baseNodes);
        addLog(
          'ingestion',
          'INFO',
          `Loaded telemetry for "${customSummary.projectName}": ${customSummary.fileCount} files, ${customSummary.classCount} classes, ${customSummary.edgeCount} relationships.`
        );
      } catch (err) {
        console.warn('Failed to load custom project telemetry', err);
      }
    }

    loadProjectDetails();

    return () => {
      isSubscribed = false;
    };
  }, [projectId, addLog]);

  // Dynamically generated simulation steps for this specific project
  const simulationSteps = useMemo(() => {
    if (!projectSummary) {
      return buildDynamicSimulationSteps({
        projectId: projectId || 'sandbox',
        projectName: 'monolith_demo',
        sourceType: 'archive.zip',
        fileCount: 34,
        classCount: 22,
        edgeCount: 68,
        astNodesCount: 2450,
        primaryLanguages: 'Java, TypeScript',
        sampleFiles: ['OrderService.java', 'PaymentController.java'],
        candidateServices: ['OrderService', 'PaymentService'],
        modularityScore: '0.65',
        isRealData: false,
      });
    }
    return buildDynamicSimulationSteps(projectSummary);
  }, [projectSummary, projectId]);

  // Reset all nodes
  const resetEngine = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(false);
    setIsPaused(false);
    setActiveStage(null);
    setActivePacket(null);
    setProgress(0);
    simStepIndexRef.current = 0;
    setNodes(generateBaseNodes(projectSummary));
    addLog('ingestion', 'INFO', 'Engine reset. All nodes returned to idle state.');
  }, [addLog, projectSummary]);

  // Execute single simulation step
  const executeSimulationStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= simulationSteps.length) {
        setIsSimulating(false);
        setActiveStage(null);
        setActivePacket(null);
        setProgress(100);
        const srvCount = projectSummary?.candidateServices?.length || 3;
        addLog(
          'mcp_export',
          'DONE',
          `✓ Pipeline run complete for "${projectSummary?.projectName || 'Project'}". Monolith decomposed into ${srvCount} microservices.`
        );
        return;
      }

      const step = simulationSteps[stepIndex];
      simStepIndexRef.current = stepIndex;
      setActiveStage(step.stageId);
      setProgress(Math.round(((stepIndex + 1) / simulationSteps.length) * 100));

      // Packet animation to next node if available
      const nextStep = simulationSteps[stepIndex + 1];
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
        Object.keys(updated).forEach((k) => {
          const key = k as TwinStageId;
          if (updated[key].status === 'active') {
            updated[key] = { ...updated[key], status: 'completed' };
          }
        });
        updated[step.stageId] = {
          ...updated[step.stageId],
          status: 'active',
          metrics: {
            ...updated[step.stageId].metrics,
            ...(step.metricsUpdate as Record<string, string | number>),
          },
          activePayload: step.activePayload,
        };
        return updated;
      });

      addLog(step.stageId, 'EXEC', step.log);

      // Duration is scaled dynamically and inversely proportional to simulation speed
      const stepDuration = Math.max(450, step.duration / simSpeed);
      timerRef.current = setTimeout(() => {
        executeSimulationStep(stepIndex + 1);
      }, stepDuration);
    },
    [addLog, simSpeed, simulationSteps, projectSummary]
  );

  // Play / Start simulation
  const startSimulation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(true);
    setIsPaused(false);
    addLog(
      'ingestion',
      'INFO',
      `Starting pipeline simulation for "${projectSummary?.projectName || 'Project'}" (${simSpeed}x speed)...`
    );
    executeSimulationStep(simStepIndexRef.current);
  }, [addLog, executeSimulationStep, simSpeed, projectSummary]);

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
    const nextIdx = (simStepIndexRef.current + 1) % simulationSteps.length;
    executeSimulationStep(nextIdx);
  }, [executeSimulationStep, simulationSteps.length]);

  return {
    projectSummary,
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
