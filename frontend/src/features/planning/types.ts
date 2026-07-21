export type CloudProvider = 'aws' | 'azure' | 'gcp';
export type RiskTolerance = 'low' | 'medium' | 'high';

export interface PlanAssumptions {
  cloud_provider: CloudProvider;
  pricing_region: string;
  cost_multiplier: number;
  team_count: number;
  risk_tolerance: RiskTolerance;
  migration_window_months: number;
}

export interface MigrationStage {
  stage_number: number;
  name: string;
  description: string;
  target_services: string[];
  effort_estimate_weeks: number;
  rollout_method: string;
  rollback_condition: string;
  success_metric: string;
}

export interface RoadmapPlan {
  pattern_recommended: string;
  total_duration_weeks: number;
  stages: MigrationStage[];
}

export interface ConsistencySecurityItem {
  source_service: string;
  target_service: string;
  operation_type: string;
  recommended_pattern: string;
  data_category: string;
  encryption_required: boolean;
  audit_required: boolean;
}

export interface ConsistencySecurityMatrix {
  items: ConsistencySecurityItem[];
  risk_summary: string;
}

export interface CostPerformanceSimulation {
  monolith_monthly_cost_usd: number;
  microservices_monthly_cost_usd: number;
  cost_range_min_usd: number;
  cost_range_max_usd: number;
  avg_latency_increase_ms: number;
  sensitivity_drivers: string[];
}

export interface TeamAssignment {
  team_name: string;
  assigned_services: string[];
  capacity_status: string;
  spof_warning?: string | null;
}

export interface TeamMappingPlan {
  team_assignments: TeamAssignment[];
  unassigned_services: string[];
}

export interface PlanReport {
  success: boolean;
  assumptions: PlanAssumptions;
  roadmap: RoadmapPlan;
  consistency_security: ConsistencySecurityMatrix;
  cost_performance: CostPerformanceSimulation;
  team_mapping: TeamMappingPlan;
}

export interface PlanRevision {
  id: string;
  plan_id: string;
  revision_number: number;
  is_selected: boolean;
  assumptions: PlanAssumptions;
  roadmap: RoadmapPlan;
  consistency_security: ConsistencySecurityMatrix;
  cost_performance: CostPerformanceSimulation;
  team_mapping: TeamMappingPlan;
  created_at: string;
}

export interface MigrationPlan {
  id: string;
  project_id: string;
  scenario_revision_id: string | null;
  owner_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  revisions?: PlanRevision[];
  latest_revision?: PlanRevision;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}
