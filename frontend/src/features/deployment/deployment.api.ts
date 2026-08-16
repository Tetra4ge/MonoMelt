import type { Deployment, ServiceHealth } from './types';
import api from '../../lib/api';

export async function triggerDeployment(projectId: string, blueprintId: string): Promise<Deployment> {
  const response = await api.post(`/api/projects/${projectId}/deployments`, { blueprintId });
  return response.data.data;
}

export async function getDeploymentLogs(projectId: string, deploymentId: string): Promise<Deployment> {
  const response = await api.get(`/api/projects/${projectId}/deployments/${deploymentId}`);
  return response.data.data;
}

export async function getServicesHealth(projectId: string, deploymentId: string): Promise<ServiceHealth[]> {
  const response = await api.get(`/api/projects/${projectId}/deployments/${deploymentId}/services`);
  return response.data.data;
}
