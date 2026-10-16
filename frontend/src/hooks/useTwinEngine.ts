import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { TwinStageId, TwinNode, TwinLog, TwinSimulationStep, TwinProjectSummary } from '../types/twin.types';
import api from '../lib/api';
import { supabase } from '../lib/supabase';

function generateBaseNodes(summary?: TwinProjectSummary | null): Record<TwinStageId, TwinNode> {
  const isReal = !!summary?.isRealData;
  const pName = summary?.projectName || 'monolith_workspace';
  const fileCount = summary?.fileCount || 0;
  const edgeCount = summary?.edgeCount || 0;
  const astCount = summary?.astNodesCount || 0;
  const nodeCount = summary?.nodeCount || 0;
  const clusterCount = summary?.candidateServices?.length || 0;
  const cohesion = summary?.cohesion || 'n/a';

  return {
    ingestion: {
      id: 'ingestion',
      stageNumber: '01',
      label: 'INGESTION_GATEWAY',
      service: 'API Gateway / Express',
      status: 'idle',
      tech: 'Node.js 22, Express 5, Multer, Supabase Auth',
      portOrChannel: ':4000 / POST /api/projects/:id/sources',
      role: 'Authenticates the user, checks project ownership, validates the ZIP signature or GitHub URL, records the source version and queues an ingestion job.',
      whyThisStep: 'Rejects malformed or foreign requests before any heavy work starts, and returns immediately with a job id instead of holding the connection open.',
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
      service: 'Redis / BullMQ',
      status: 'idle',
      tech: 'Redis 7, BullMQ, ioredis',
      portOrChannel: ':6380 [ingestion, report-generation]',
      role: 'Holds ingestion and report jobs, retries failures with exponential backoff, and carries the report-updates channel the gateway relays to the browser.',
      whyThisStep: 'Unpacking and analysing a repository takes seconds to minutes. A queue keeps HTTP requests short and lets the worker run independently.',
      metrics: {
        queues: 'ingestion, report-generation',
        retries: '3, exponential backoff',
        job_state: isReal ? 'completed' : 'idle',
      },
    },
    worker_engine: {
      id: 'worker_engine',
      stageNumber: '03',
      label: 'WORKER_COORDINATOR',
      service: 'Ingestion Worker + FastAPI Analysis Service',
      status: 'idle',
      tech: 'Node.js worker (adm-zip), Python 3.12, FastAPI, asyncio',
      portOrChannel: ':8000 POST /analysis/trigger',
      role: 'The worker unpacks the archive, stores source files and a manifest, then asks the AI service to analyse; the AI service downloads the files in parallel and parses them.',
      whyThisStep: 'Keeping extraction and analysis out of the gateway means a bad archive or a slow parse can never take the API down.',
      metrics: {
        languages: summary?.primaryLanguages || 'Detecting...',
        download_threads: 8,
        trigger: 'POST /analysis/trigger',
      },
    },
    tree_sitter: {
      id: 'tree_sitter',
      stageNumber: '04',
      label: 'AST_PARSER',
      service: 'AST Parser + Import Resolver',
      status: 'idle',
      tech: 'Python ast (Python), tolerant regex extraction (JS/TS)',
      portOrChannel: 'services/ast_parser.py',
      role: 'Extracts classes, functions and imports from each file, then resolves every import to the uploaded file it points to so the graph has real file-to-file edges.',
      whyThisStep: 'Dependencies are only useful if they point at real files. Resolution turns a list of module names into a connected graph.',
      metrics: {
        target_files: isReal ? fileCount : 0,
        lines_parsed: isReal ? astCount : 0,
        symbols: isReal ? (summary?.symbolCount ?? 0) : 0,
        parse_issues: isReal ? (summary?.parseIssues ?? 0) : 0,
      },
    },
    neo4j_graph: {
      id: 'neo4j_graph',
      stageNumber: '05',
      label: 'NEO4J_TOPOLOGY',
      service: 'Neo4j Graph Database',
      status: 'idle',
      tech: 'Neo4j Aura, Cypher, Bolt',
      portOrChannel: 'neo4j+s:// (Aura)',
      role: 'Stores files, symbols and external packages with IMPORTS and CONTAINS edges, scoped to the owner, project and source version.',
      whyThisStep: 'Cycles, fan-in and fan-out and independent components are graph questions; a graph database answers them directly.',
      metrics: {
        graph_nodes: isReal ? nodeCount : 0,
        import_edges: isReal ? edgeCount : 0,
        density: nodeCount > 1 ? (edgeCount / (nodeCount * (nodeCount - 1))).toFixed(3) : '0.000',
      },
    },
    decomposition: {
      id: 'decomposition',
      stageNumber: '06',
      label: 'DECOMPOSITION_AI',
      service: 'Louvain Community Detection',
      status: 'idle',
      tech: 'NetworkX, python-louvain',
      portOrChannel: 'services/decomposition_engine.py',
      role: 'Clusters the file import graph into candidate services (conservative, aggressive or by package structure), folds isolated files together and names each service.',
      whyThisStep: 'Boundaries come from how the code is actually connected, so the chosen split keeps tightly related files together.',
      metrics: {
        candidate_services: isReal ? clusterCount : 0,
        cohesion: isReal ? cohesion : 'n/a',
        strategy: isReal ? (summary?.strategy || 'n/a') : 'n/a',
      },
    },
    mcp_export: {
      id: 'mcp_export',
      stageNumber: '07',
      label: 'MCP_SYNCHRONIZER',
      service: 'Blueprint Export + Notion MCP',
      status: 'idle',
      tech: 'Blueprint generator, Model Context Protocol, Notion',
      portOrChannel: ':4000 POST /api/projects/:id/reports/export/notion',
      role: 'Packages the plan as a blueprint ZIP and a report, and can send the report to Notion through an MCP server.',
      whyThisStep: 'The analysis only helps once the team can act on it: deployable starting files for engineers and a readable report for everyone else.',
      metrics: {
        blueprints_ready: isReal ? (summary?.blueprintCount ?? 0) : 0,
        notion_synced: isReal ? (summary?.notionSynced ? 'synced' : 'not synced') : 'pending',
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
  const qScore = summary.cohesion || 'n/a';

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
        job_state: 'queued',
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
        download_threads: 8,
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
      log: `[AST] Parsed ${fileCount} files (${astCount} lines) and resolved their imports. Files: ${filesList}...`,
      packetLabel: `PARSED_LINES[${astCount}]`,
      metricsUpdate: {
        target_files: fileCount,
        lines_parsed: astCount,
        symbols: summary.symbolCount,
        parse_issues: summary.parseIssues,
      },
      activePayload: {
        item: summary.sampleFiles[0] ? `AST::${summary.sampleFiles[0]}` : 'AST::SyntaxDeclaration',
        type: 'ParsedFile',
        size: `${astCount} lines`,
      },
    },
    {
      stageId: 'neo4j_graph',
      duration: tNeo,
      log: `[NEO4J] Graph written: ${summary.nodeCount} nodes, ${edgeCount} dependency edges.`,
      packetLabel: `GRAPH_EDGES[${edgeCount}]`,
      metricsUpdate: {
        graph_nodes: summary.nodeCount,
        import_edges: edgeCount,
        density: summary.nodeCount > 1 ? (edgeCount / (summary.nodeCount * (summary.nodeCount - 1))).toFixed(3) : '0.000',
      },
      activePayload: {
        item: `CypherTopology::${pName}`,
        type: 'DirectedGraph',
        size: `${summary.nodeCount} nodes, ${edgeCount} edges`,
      },
    },
    {
      stageId: 'decomposition',
      duration: tDecomp,
      log: `[DECOMPOSITION] ${summary.strategy} strategy: ${clusterCount} candidate services (cohesion ${qScore}): [${clusters}].`,
      packetLabel: `SERVICES[${clusterCount}]`,
      metricsUpdate: {
        candidate_services: clusterCount,
        cohesion: qScore,
        strategy: summary.strategy,
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
      log: `[EXPORT] Blueprint and report cover ${clusterCount} services. ${summary.notionSynced ? 'The report is already in Notion.' : 'Send the report to Notion from the report page.'}`,
      packetLabel: 'MCP_NOTION_SYNC',
      metricsUpdate: {
        blueprints_ready: summary.blueprintCount,
        notion_synced: summary.notionSynced ? 'synced' : 'not synced',
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

const SANDBOX_SUMMARY: TwinProjectSummary = {
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
  cohesion: '0.68',
  strategy: 'domain',
  nodeCount: 142,
  symbolCount: 118,
  blueprintCount: 3,
  notionSynced: false,
  parseIssues: 0,
  isRealData: false,
};

export function useTwinEngine(projectId?: string) {
  const isSandbox = !projectId || projectId === 'sandbox';
  const [loadedSummary, setProjectSummary] = useState<TwinProjectSummary | null>(null);
  // The sandbox demo needs no data loading, so it is derived rather than set from an effect.
  const projectSummary = isSandbox ? SANDBOX_SUMMARY : loadedSummary;
  const [nodes, setNodes] = useState<Record<TwinStageId, TwinNode>>(() => generateBaseNodes(isSandbox ? SANDBOX_SUMMARY : null));
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
  // Index of the step that ran last (-1 until one has run), so Step always advances from the right place
  const lastExecutedRef = useRef(-1);
  // Lets a step schedule the next one without referring to its own binding
  const executeRef = useRef<(stepIndex: number) => void>(() => undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to append log
  const addLog = useCallback((stageId: TwinStageId, level: TwinLog['level'], message: string) => {
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        stageId,
        level,
        message,
      },
      ...prev.slice(0, 99),
    ]);
  }, []);

  // Load the real project: metrics, graph totals, the latest decomposition, blueprints and report state
  useEffect(() => {
    if (isSandbox) return;

    let isSubscribed = true;

    async function loadProjectDetails() {
      try {
        // 1. Project metadata
        const projectRes = await api.get(`/api/projects/${projectId}`).catch(() => null);
        const projectData = projectRes?.data?.data || {};

        // 2. Latest analysis job
        const { data: jobs } = await supabase
          .from('analysis_jobs')
          .select('id, source_version_id, status, error_code')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);

        const latestJob = jobs?.[0] || null;
        let metricsData: any = null;
        let graphData: any = { nodes: [], edges: [] };
        let blueprints: any[] = [];
        let latestReport: any = null;
        let diagnostics: any = null;
        let proposedServices: any[] = [];
        let strategy = 'n/a';

        if (latestJob?.source_version_id) {
          const svid = latestJob.source_version_id;
          const [mRes, gRes, sRes, bRes, rRes, dRes] = await Promise.allSettled([
            api.get(`/api/projects/${projectId}/analysis/${svid}/metrics`),
            api.get(`/api/projects/${projectId}/analysis/${svid}/graph?depth=2&limit=200`),
            api.get(`/api/projects/${projectId}/scenarios`),
            api.get(`/api/projects/${projectId}/blueprints`),
            api.get(`/api/projects/${projectId}/reports`),
            api.get(`/api/projects/${projectId}/analysis/${svid}/diagnostics`),
          ]);

          if (mRes.status === 'fulfilled') metricsData = mRes.value.data?.data;
          if (gRes.status === 'fulfilled') graphData = gRes.value.data?.data || graphData;
          if (bRes.status === 'fulfilled') blueprints = bRes.value.data?.data || [];
          if (rRes.status === 'fulfilled') latestReport = rRes.value.data?.data || null;
          if (dRes.status === 'fulfilled') diagnostics = dRes.value.data?.data || null;

          // The newest completed scenario holds the real proposed services (the list endpoint does not).
          const scenarios: any[] = sRes.status === 'fulfilled' ? sRes.value.data?.data || [] : [];
          const completed = scenarios.find((sc) => sc.status === 'completed');
          if (completed) {
            strategy = completed.strategy_type || 'n/a';
            const detail = await api.get(`/api/projects/${projectId}/scenarios/${completed.id}`).catch(() => null);
            proposedServices = detail?.data?.data?.proposed_services || [];
          }
        }

        if (!isSubscribed) return;

        const gNodes: any[] = graphData?.nodes || [];
        const gEdges: any[] = graphData?.edges || [];
        const fileNodes = gNodes.filter((n) => n.label === 'File');
        const sampleFiles = fileNodes
          .map((n) => String(n.file_path || n.name || '').split('/').pop() || '')
          .filter(Boolean)
          .slice(0, 6);

        const candidateServices: string[] = proposedServices.map((svc) => svc.name).filter(Boolean);
        const sum = (key: string) => proposedServices.reduce((acc, svc) => acc + Number(svc.metrics?.[key] || 0), 0);
        const internalEdges = sum('internal_edges');
        const crossEdges = sum('external_edges_out');
        const cohesion = internalEdges + crossEdges > 0 ? (internalEdges / (internalEdges + crossEdges)).toFixed(2) : 'n/a';

        let langs = 'Not detected';
        if (metricsData?.language_breakdown && typeof metricsData.language_breakdown === 'object') {
          langs = Object.entries(metricsData.language_breakdown)
            .map(([lang, count]) => `${lang.toUpperCase()} (${count})`)
            .slice(0, 3)
            .join(', ') || langs;
        }

        const safeProjectId = projectId || 'sandbox';
        const customSummary: TwinProjectSummary = {
          projectId: safeProjectId,
          projectName: projectData.name || `project_${safeProjectId.slice(0, 8)}`,
          sourceType: projectData.source_type || 'github',
          fileCount: metricsData?.total_files ?? fileNodes.length,
          classCount: metricsData?.total_classes ?? 0,
          edgeCount: graphData?.total_edges ?? gEdges.length,
          astNodesCount: metricsData?.total_lines ?? 0,
          primaryLanguages: langs,
          sampleFiles,
          candidateServices,
          cohesion,
          strategy,
          nodeCount: graphData?.total_nodes ?? gNodes.length,
          symbolCount: Number(metricsData?.total_functions || 0) + Number(metricsData?.total_classes || 0),
          blueprintCount: blueprints.length,
          notionSynced: !!latestReport?.notion_url,
          parseIssues: Number(diagnostics?.total || 0),
          isRealData: true,
        };

        setProjectSummary(customSummary);
        const baseNodes = generateBaseNodes(customSummary);

        // A finished analysis is shown with every stage completed, carrying the real values.
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
          `Loaded telemetry for "${customSummary.projectName}": ${customSummary.fileCount} files, ${customSummary.symbolCount} symbols, ${customSummary.edgeCount} dependency edges, ${candidateServices.length} candidate services.`
        );
      } catch (err) {
        console.warn('Failed to load project telemetry', err);
      }
    }

    loadProjectDetails();

    return () => {
      isSubscribed = false;
    };
  }, [projectId, isSandbox, addLog]);

  // Dynamically generated simulation steps for this specific project
  const simulationSteps = useMemo(
    () => buildDynamicSimulationSteps(projectSummary ?? SANDBOX_SUMMARY),
    [projectSummary]
  );

  // Reset all nodes
  const resetEngine = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSimulating(false);
    setIsPaused(false);
    setActiveStage(null);
    setActivePacket(null);
    setProgress(0);
    simStepIndexRef.current = 0;
    lastExecutedRef.current = -1;
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
      lastExecutedRef.current = stepIndex;
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
        executeRef.current(stepIndex + 1);
      }, stepDuration);
    },
    [addLog, simSpeed, simulationSteps, projectSummary]
  );

  useEffect(() => {
    executeRef.current = executeSimulationStep;
  }, [executeSimulationStep]);

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
    // Advance from the step that last ran; after a reset (-1) the first Step runs stage 01.
    const nextIdx = (lastExecutedRef.current + 1) % simulationSteps.length;
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
