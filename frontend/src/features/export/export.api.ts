import api from '../../lib/api';
import type { ApiEnvelope, Blueprint } from './types';

export async function createBlueprint(projectId: string, planId: string): Promise<Blueprint> {
  const response = await api.post<ApiEnvelope<Blueprint>>(`/api/projects/${projectId}/blueprints`, {
    planId
  });
  return response.data.data;
}

export async function getBlueprints(projectId: string): Promise<Blueprint[]> {
  const response = await api.get<ApiEnvelope<Blueprint[]>>(`/api/projects/${projectId}/blueprints`);
  return response.data.data ?? [];
}

export async function getBlueprint(projectId: string, blueprintId: string): Promise<Blueprint> {
  const response = await api.get<ApiEnvelope<Blueprint>>(`/api/projects/${projectId}/blueprints/${blueprintId}`);
  return response.data.data;
}
