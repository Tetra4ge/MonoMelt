-- ==========================================
-- Phase 9: Report Agent & Notion Integration
-- ==========================================

-- 1. Custom Enumeration Type for Report Lifecycle
CREATE TYPE report_status AS ENUM (
    'pending',      -- Job is queued in BullMQ but Python has not started
    'generating',   -- Python FastAPI is actively querying Neo4j/LLMs
    'completed',    -- JSON is finalized and ready for Dashboard/Notion export
    'failed'        -- An error occurred during aggregation or generation
);

-- 2. Core Table: project_reports
CREATE TABLE IF NOT EXISTS public.project_reports (
    -- Primary Identity
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign Key Relations
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Version Control
    version_number INTEGER NOT NULL DEFAULT 1,
    
    -- State Management
    status report_status NOT NULL DEFAULT 'pending',
    
    -- Core Data
    payload JSONB DEFAULT '{}'::jsonb,
    
    -- External Integrations
    notion_url TEXT DEFAULT NULL,
    
    -- Audit Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Idempotency Constraint
    -- Ensures we never have two "v1" reports for the same project
    CONSTRAINT unique_project_version UNIQUE(project_id, version_number)
);

-- 3. Indexing Strategy for Performance
-- Optimize looking up all reports for a specific project
CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON public.project_reports(project_id);

-- Optimize checking the status of reports (useful for the BullMQ worker polling)
CREATE INDEX IF NOT EXISTS idx_project_reports_status ON public.project_reports(status);

-- GIN index to search inside the JSONB payload in the future
CREATE INDEX IF NOT EXISTS idx_project_reports_payload ON public.project_reports USING GIN (payload);

-- 4. Row Level Security (RLS) Implementation
-- Turn on the RLS engine for this specific table
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;

-- Read Policy: Users can only view their own project reports
CREATE POLICY "Users can view their own project reports"
ON public.project_reports
FOR SELECT
USING (auth.uid() = owner_id);

-- Delete Policy: Users can delete their own historical reports
CREATE POLICY "Users can delete their own project reports"
ON public.project_reports
FOR DELETE
USING (auth.uid() = owner_id);

-- NOTE: 
-- There are intentionally NO Insert or Update policies for standard authenticated users.
-- The Python and Node.js backend workers will bypass RLS to insert/update rows 
-- by utilizing the SUPABASE_SERVICE_ROLE_KEY.
