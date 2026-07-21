import api from '../../lib/api';
import type { ApiEnvelope, MigrationPlan, PlanAssumptions, PlanReport } from './types';

export async function listPlans(projectId: string): Promise<MigrationPlan[]> {
  const response = await api.get<ApiEnvelope<MigrationPlan[]>>(`/api/projects/${projectId}/plans`);
  return response.data.data ?? [];
}

export async function getPlan(projectId: string, planId: string): Promise<MigrationPlan> {
  const response = await api.get<ApiEnvelope<MigrationPlan>>(`/api/projects/${projectId}/plans/${planId}`);
  return response.data.data;
}

export async function createPlan(
  projectId: string,
  scenarioId: string,
  assumptions: PlanAssumptions,
  title = 'Microservice Migration Plan',
): Promise<MigrationPlan> {
  const response = await api.post<ApiEnvelope<MigrationPlan>>(
    `/api/projects/${projectId}/scenarios/${scenarioId}/plans`,
    { title, assumptions },
  );
  return response.data.data;
}

export async function recalculatePlan(
  projectId: string,
  planId: string,
  assumptions: PlanAssumptions,
): Promise<MigrationPlan> {
  const response = await api.post<ApiEnvelope<MigrationPlan>>(
    `/api/projects/${projectId}/plans/${planId}/assumptions`,
    { assumptions },
  );
  return response.data.data;
}

export function getLatestReport(plan: MigrationPlan | null): PlanReport | null {
  const revision = plan?.latest_revision ?? plan?.revisions?.[0];
  if (!revision) return null;
  return {
    success: true,
    assumptions: revision.assumptions,
    roadmap: revision.roadmap,
    consistency_security: revision.consistency_security,
    cost_performance: revision.cost_performance,
    team_mapping: revision.team_mapping,
  };
}
