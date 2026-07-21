-- ============================================================
-- Phase 6: Migration Planning — PostgreSQL Schema
-- ============================================================
-- Tables: migration_plans, plan_revisions
-- Run this AFTER 05_phase5_decomposition.sql

-- migration_plans: master table for phase 6 plans
CREATE TABLE IF NOT EXISTS public.migration_plans (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id           UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  scenario_revision_id UUID REFERENCES public.scenario_revisions(id) ON DELETE SET NULL,
  owner_id             UUID NOT NULL,
  title                TEXT DEFAULT 'Microservice Migration Plan' NOT NULL,
  status               TEXT DEFAULT 'completed' NOT NULL,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- plan_revisions: stores immutable versions of recalculated plans
CREATE TABLE IF NOT EXISTS public.plan_revisions (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_id               UUID REFERENCES public.migration_plans(id) ON DELETE CASCADE NOT NULL,
  revision_number       INTEGER DEFAULT 1 NOT NULL,
  is_selected           BOOLEAN DEFAULT true NOT NULL,
  assumptions           JSONB DEFAULT '{}'::jsonb NOT NULL,
  roadmap               JSONB DEFAULT '{}'::jsonb NOT NULL,
  consistency_security  JSONB DEFAULT '{}'::jsonb NOT NULL,
  cost_performance      JSONB DEFAULT '{}'::jsonb NOT NULL,
  team_mapping          JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Row Level Security
ALTER TABLE public.migration_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own migration plans"
  ON public.migration_plans FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create own migration plans"
  ON public.migration_plans FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own migration plans"
  ON public.migration_plans FOR UPDATE
  USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_migration_plans_project ON public.migration_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON public.plan_revisions(plan_id);
