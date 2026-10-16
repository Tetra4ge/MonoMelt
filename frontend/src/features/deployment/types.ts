export interface Deployment {
  id: string;
  project_id: string;
  blueprint_id: string;
  status: 'building' | 'provisioning' | 'deploying' | 'deployed' | 'failed';
  logs: string[];
  created_at: string;
  updated_at: string;
}

export interface ServiceHealth {
  service_name: string;
  /** 'simulated' while the deployment is a simulation; a live status once real provisioning exists */
  status?: 'simulated' | 'healthy' | 'unhealthy';
  uptime: string;
  cpu_usage: string;
  memory: string;
  endpoint_url: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}
