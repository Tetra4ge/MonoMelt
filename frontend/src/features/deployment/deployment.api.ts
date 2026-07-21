import type { Deployment, ServiceHealth } from './types';

// NOTE: Since the backend API for deployment provisioning isn't fully built for the hackathon,
// we are simulating the deployment orchestration entirely on the frontend to demonstrate the UI flow.

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function triggerDeployment(projectId: string, blueprintId: string): Promise<Deployment> {
  await delay(800); // Simulate network latency
  
  return {
    id: `dep-${Date.now()}`,
    project_id: projectId,
    blueprint_id: blueprintId,
    status: 'building',
    logs: ['[SYSTEM] Initiating deployment pipeline...', '[SYSTEM] Connecting to cloud provider...'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function getDeploymentLogs(projectId: string, deploymentId: string): Promise<Deployment> {
  await delay(500); // Simulate polling latency
  if (!projectId) throw new Error('Missing project ID');
  
  return {
    id: deploymentId,
    project_id: projectId,
    blueprint_id: 'mock-blueprint',
    status: 'deployed', // In the actual UI implementation, we'll progressively mock this state
    logs: [
      '[SYSTEM] Initiating deployment pipeline...',
      '[SYSTEM] Connecting to cloud provider...',
      '[DOCKER] Building images for 4 microservices...',
      '[DOCKER] Images pushed to registry successfully.',
      '[TERRAFORM] Initializing provider plugins...',
      '[TERRAFORM] Creating AWS VPC and Subnets...',
      '[TERRAFORM] Provisioning ECS Cluster...',
      '[SYSTEM] Deploying services to cluster...',
      '[SYSTEM] Running health checks...',
      '[SYSTEM] Deployment completed successfully.'
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function getServicesHealth(projectId: string): Promise<ServiceHealth[]> {
  await delay(600);
  if (!projectId) throw new Error('Missing project ID');
  
  return [
    {
      service_name: 'api-gateway',
      uptime: '99.9%',
      cpu_usage: '4%',
      memory: '128MB',
      endpoint_url: 'https://api.monomelt.app'
    },
    {
      service_name: 'auth-service',
      uptime: '100%',
      cpu_usage: '2%',
      memory: '64MB',
      endpoint_url: 'https://auth.monomelt.app'
    },
    {
      service_name: 'payment-service',
      uptime: '99.8%',
      cpu_usage: '12%',
      memory: '256MB',
      endpoint_url: 'https://payments.monomelt.app'
    },
    {
      service_name: 'ai-worker',
      uptime: '100%',
      cpu_usage: '45%',
      memory: '1.2GB',
      endpoint_url: 'internal.ai.monomelt.app'
    }
  ];
}
