-- ============================================================
-- Phase 4: Intelligence — PostgreSQL Schema
-- ============================================================
-- Tables: ai_findings
-- Run this AFTER 03_phase3_analysis.sql

-- ai_findings: stores LLM-generated insights, domains, and risks
CREATE TABLE IF NOT EXISTS public.ai_findings (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_version_id UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  owner_id          UUID NOT NULL,
  
  finding_type      TEXT NOT NULL, -- e.g., 'domain', 'transaction', 'risk', 'sensitivity'
  subject_ids       JSONB DEFAULT '[]'::jsonb, -- array of graph node IDs involved
  explanation       TEXT NOT NULL,
  confidence        FLOAT NOT NULL,
  evidence_ids      JSONB DEFAULT '[]'::jsonb, -- array of node/edge IDs as proof
  model_metadata    JSONB DEFAULT '{}'::jsonb, -- token cost, model version, etc
  
  needs_review      BOOLEAN DEFAULT true,
  review_status     TEXT DEFAULT 'pending', -- pending | approved | rejected
  
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Add AI enrichment status to analysis_jobs
ALTER TABLE public.analysis_jobs
ADD COLUMN IF NOT EXISTS ai_enrichment_status TEXT DEFAULT 'pending';

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.ai_findings ENABLE ROW LEVEL SECURITY;

-- ai_findings: owner can view
CREATE POLICY "Users can view own AI findings"
  ON public.ai_findings FOR SELECT
  USING (owner_id = auth.uid());

-- ai_findings: owner can create
CREATE POLICY "Users can create own AI findings"
  ON public.ai_findings FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- ai_findings: owner can update (e.g. for review_status)
CREATE POLICY "Users can update own AI findings"
  ON public.ai_findings FOR UPDATE
  USING (owner_id = auth.uid());

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_findings_project
  ON public.ai_findings(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_findings_source_version
  ON public.ai_findings(source_version_id);

CREATE INDEX IF NOT EXISTS idx_ai_findings_type
  ON public.ai_findings(finding_type);
