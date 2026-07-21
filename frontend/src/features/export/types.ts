export interface BlueprintFile {
  name: string;
  content: string;
}

export interface Blueprint {
  id: string;
  project_id: string;
  plan_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  terraform_code?: Record<string, string>;
  service_code?: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}
