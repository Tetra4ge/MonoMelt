export type TwinStageId =
  | 'ingestion'
  | 'redis_queue'
  | 'worker_engine'
  | 'tree_sitter'
  | 'neo4j_graph'
  | 'decomposition'
  | 'mcp_export';

export type TwinNodeStatus = 'idle' | 'active' | 'completed' | 'error';

export interface TwinNode {
  id: TwinStageId;
  stageNumber: string; // '01', '02', etc.
  label: string; // e.g. 'INGESTION_GATEWAY'
  service: string; // e.g. 'API Gateway / Express'
  status: TwinNodeStatus;
  tech: string; // e.g. 'Node.js 20, Express, Multer'
  portOrChannel: string; // e.g. ':5000' or 'redis:jobs'
  role: string; // Architectural summary
  whyThisStep: string; // Plain English architecture lesson
  metrics: Record<string, string | number>;
  activePayload?: {
    item?: string;
    type?: string;
    size?: string;
    extra?: Record<string, any>;
  };
}

export interface TwinLog {
  id: string;
  timestamp: string;
  stageId: TwinStageId;
  level: 'INFO' | 'EXEC' | 'WARN' | 'DONE';
  message: string;
  details?: string;
}

export interface TwinSimulationStep {
  stageId: TwinStageId;
  duration: number; // in ms at 1x speed
  log: string;
  packetLabel: string;
  metricsUpdate: Partial<Record<string, string | number>>;
  activePayload?: {
    item: string;
    type: string;
    size?: string;
    extra?: Record<string, any>;
  };
}

export interface TwinProjectSummary {
  projectId: string;
  projectName: string;
  sourceType: string;
  fileCount: number;
  classCount: number;
  edgeCount: number;
  astNodesCount: number;
  primaryLanguages: string;
  sampleFiles: string[];
  candidateServices: string[];
  /** Share of dependency edges that stay inside a service (internal / (internal + cross-service)). */
  cohesion: string;
  /** Decomposition strategy of the scenario the services come from. */
  strategy: string;
  /** Total nodes in the dependency graph (files, symbols and external packages). */
  nodeCount: number;
  /** Functions, methods and classes found by the parser. */
  symbolCount: number;
  blueprintCount: number;
  notionSynced: boolean;
  /** Parser errors and warnings recorded for the analysis run. */
  parseIssues: number;
  isRealData: boolean;
}

export interface TwinEngineState {
  nodes: Record<TwinStageId, TwinNode>;
  activeStage: TwinStageId | null;
  activePacket: { from: TwinStageId; to: TwinStageId; label: string } | null;
  logs: TwinLog[];
  isSimulating: boolean;
  isPaused: boolean;
  simSpeed: 1 | 2 | 4;
  mode: 'live' | 'simulation';
  progress: number; // 0 - 100
  selectedNodeId: TwinStageId | null;
  projectSummary?: TwinProjectSummary | null;
}
