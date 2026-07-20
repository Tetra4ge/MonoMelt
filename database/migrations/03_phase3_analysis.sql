-- ============================================================
-- Phase 3: Analysis Engine — PostgreSQL Schema
-- ============================================================
-- Tables: analysis_runs, parser_diagnostics, code_metrics
-- Run this AFTER 02_phase2_ingestion.sql

-- analysis_runs: tracks each run of the analysis pipeline
CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_version_id UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  owner_id          UUID NOT NULL,
  status            TEXT DEFAULT 'pending' NOT NULL,
    -- pending | running | completed | failed
  parser_version    TEXT DEFAULT '1.0' NOT NULL,
  started_at        TIMESTAMP WITH TIME ZONE,
  completed_at      TIMESTAMP WITH TIME ZONE,
  error_message     TEXT,
  graph_summary     JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- parser_diagnostics: per-file warnings and errors from the parser
CREATE TABLE IF NOT EXISTS public.parser_diagnostics (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_run_id  UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE NOT NULL,
  file_path        TEXT NOT NULL,
  parser           TEXT NOT NULL,
  severity         TEXT NOT NULL, -- warning | error
  message          TEXT NOT NULL,
  line_number      INTEGER,
  column_number    INTEGER,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- code_metrics: aggregate metrics per analysis run
CREATE TABLE IF NOT EXISTS public.code_metrics (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_run_id       UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE NOT NULL,
  source_version_id     UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  total_files           INTEGER DEFAULT 0,
  total_lines           INTEGER DEFAULT 0,
  total_functions       INTEGER DEFAULT 0,
  total_classes         INTEGER DEFAULT 0,
  total_modules         INTEGER DEFAULT 0,
  unresolved_imports    INTEGER DEFAULT 0,
  cycle_count           INTEGER DEFAULT 0,
  graph_components      INTEGER DEFAULT 0,
  language_breakdown    JSONB DEFAULT '{}'::jsonb,
  top_fan_in            JSONB DEFAULT '[]'::jsonb,
  top_fan_out           JSONB DEFAULT '[]'::jsonb,
  centrality_candidates JSONB DEFAULT '[]'::jsonb,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.analysis_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parser_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_metrics       ENABLE ROW LEVEL SECURITY;

-- analysis_runs: owner can view and create
CREATE POLICY "Users can view own analysis runs"
  ON public.analysis_runs FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own analysis runs"
  ON public.analysis_runs FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- parser_diagnostics: accessible through analysis_run ownership
CREATE POLICY "Users can view own diagnostics"
  ON public.parser_diagnostics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_runs ar
      WHERE ar.id = parser_diagnostics.analysis_run_id
        AND ar.owner_id = auth.uid()
    )
  );

-- code_metrics: accessible through analysis_run ownership
CREATE POLICY "Users can view own metrics"
  ON public.code_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_runs ar
      WHERE ar.id = code_metrics.analysis_run_id
        AND ar.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analysis_runs_svid
  ON public.analysis_runs(source_version_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_project_status
  ON public.analysis_runs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_diagnostics_run
  ON public.parser_diagnostics(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_metrics_run
  ON public.code_metrics(analysis_run_id);
