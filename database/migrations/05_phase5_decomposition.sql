-- ============================================================
-- Phase 5: Decomposition Engine — PostgreSQL Schema
-- ============================================================
-- Tables: decomposition_scenarios, scenario_revisions, proposed_services
-- Run this AFTER 04_phase4_intelligence.sql

-- 1. decomposition_scenarios: Tracks the high-level strategy run
CREATE TABLE IF NOT EXISTS public.decomposition_scenarios (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id        UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_version_id UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  owner_id          UUID NOT NULL,
  strategy_type     TEXT NOT NULL, 
  -- e.g., 'conservative', 'aggressive', 'domain', 'team'
  status            TEXT DEFAULT 'pending' NOT NULL,
  -- 'pending' | 'generating' | 'completed' | 'failed'
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. scenario_revisions: Immutable snapshots of the scenario
CREATE TABLE IF NOT EXISTS public.scenario_revisions (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  scenario_id           UUID REFERENCES public.decomposition_scenarios(id) ON DELETE CASCADE NOT NULL,
  revision_number       INTEGER NOT NULL DEFAULT 1,
  is_selected           BOOLEAN DEFAULT false,
  metrics               JSONB DEFAULT '{}'::jsonb, 
  -- e.g., overall cohesion, coupling, cycles
  validations           JSONB DEFAULT '[]'::jsonb, 
  -- e.g., high shared-write risk, authentication flows
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- 3. proposed_services: Individual services belonging to a revision
CREATE TABLE IF NOT EXISTS public.proposed_services (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  revision_id       UUID REFERENCES public.scenario_revisions(id) ON DELETE CASCADE NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  assigned_nodes    JSONB DEFAULT '[]'::jsonb NOT NULL,
  -- List of node IDs from the AST graph assigned to this service
  metrics           JSONB DEFAULT '{}'::jsonb,
  -- Cohesion and coupling scores for this specific service
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.decomposition_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposed_services ENABLE ROW LEVEL SECURITY;

-- decomposition_scenarios: owner can view and create
CREATE POLICY "Users can view own decomposition scenarios"
  ON public.decomposition_scenarios FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own decomposition scenarios"
  ON public.decomposition_scenarios FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own decomposition scenarios"
  ON public.decomposition_scenarios FOR UPDATE
  USING (owner_id = auth.uid());

-- scenario_revisions: accessible through scenario ownership
CREATE POLICY "Users can view own scenario revisions"
  ON public.scenario_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decomposition_scenarios ds
      WHERE ds.id = scenario_revisions.scenario_id
        AND ds.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own scenario revisions"
  ON public.scenario_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decomposition_scenarios ds
      WHERE ds.id = scenario_revisions.scenario_id
        AND ds.owner_id = auth.uid()
    )
  );

-- proposed_services: accessible through revision -> scenario ownership
CREATE POLICY "Users can view own proposed services"
  ON public.proposed_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scenario_revisions sr
      JOIN public.decomposition_scenarios ds ON ds.id = sr.scenario_id
      WHERE sr.id = proposed_services.revision_id
        AND ds.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own proposed services"
  ON public.proposed_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scenario_revisions sr
      JOIN public.decomposition_scenarios ds ON ds.id = sr.scenario_id
      WHERE sr.id = proposed_services.revision_id
        AND ds.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_decomp_scenarios_svid
  ON public.decomposition_scenarios(source_version_id);

CREATE INDEX IF NOT EXISTS idx_scenario_revisions_scenario
  ON public.scenario_revisions(scenario_id);

CREATE INDEX IF NOT EXISTS idx_proposed_services_revision
  ON public.proposed_services(revision_id);
