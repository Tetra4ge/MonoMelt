-- ==========================================
-- Migration 07: Phase 7 Architecture Blueprints
-- ==========================================

CREATE TABLE IF NOT EXISTS public.blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    scenario_revision_id UUID REFERENCES public.scenario_revisions(id) ON DELETE SET NULL,
    plan_revision_id UUID REFERENCES public.plan_revisions(id) ON DELETE SET NULL,
    version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    artifact_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for fast queries by project and version
CREATE INDEX IF NOT EXISTS idx_blueprints_project_id ON public.blueprints(project_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_version_number ON public.blueprints(project_id, version_number);

-- Enable RLS
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access blueprints for their projects
CREATE POLICY "Users can manage blueprints for their projects" ON public.blueprints
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.blueprints.project_id
            AND public.projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.blueprints.project_id
            AND public.projects.owner_id = auth.uid()
        )
    );
