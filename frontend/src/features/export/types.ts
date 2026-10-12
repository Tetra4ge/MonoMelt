export interface BlueprintArtifact {
  path: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
}

export interface BlueprintManifest {
  generator_version?: string;
  version_number?: number;
  artifacts?: BlueprintArtifact[];
  warnings?: string[];
  validation_results?: Record<string, boolean>;
}

export interface Blueprint {
  id: string;
  project_id: string;
  scenario_revision_id: string | null;
  plan_revision_id: string | null;
  version_number: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  manifest?: BlueprintManifest;
  created_at: string;
  /** path -> text content, returned when a blueprint is created */
  files?: Record<string, string>;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}
