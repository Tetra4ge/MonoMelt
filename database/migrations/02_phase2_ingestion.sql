-- source_versions table
CREATE TABLE IF NOT EXISTS public.source_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL, -- 'zip' or 'github'
  version_hash TEXT, -- SHA or file hash for reproducibility
  metadata JSONB DEFAULT '{}'::jsonb, -- Store branch name, git url, zip name etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- analysis_jobs table
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_version_id UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'queued' NOT NULL, -- queued, validating, ingesting, ready, analysing, completed, failed, cancelled
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- source_files table (manifest)
CREATE TABLE IF NOT EXISTS public.source_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_version_id UUID REFERENCES public.source_versions(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  content_hash TEXT,
  language TEXT,
  status TEXT DEFAULT 'included', -- included, excluded (due to reason)
  reason TEXT, -- if excluded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) Policies
ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_files ENABLE ROW LEVEL SECURITY;

-- source_versions: Users can view own project's source versions
CREATE POLICY "Users can view own project source versions" ON public.source_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = source_versions.project_id AND projects.owner_id = auth.uid()
  )
);
CREATE POLICY "Users can create own project source versions" ON public.source_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = source_versions.project_id AND projects.owner_id = auth.uid()
  )
);

-- analysis_jobs: Users can view own project's jobs
CREATE POLICY "Users can view own project analysis jobs" ON public.analysis_jobs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = analysis_jobs.project_id AND projects.owner_id = auth.uid()
  )
);
CREATE POLICY "Users can create own project analysis jobs" ON public.analysis_jobs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects WHERE projects.id = analysis_jobs.project_id AND projects.owner_id = auth.uid()
  )
);

-- source_files: Users can view own project's files
CREATE POLICY "Users can view own project source files" ON public.source_files FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.source_versions 
    JOIN public.projects ON projects.id = source_versions.project_id
    WHERE source_versions.id = source_files.source_version_id AND projects.owner_id = auth.uid()
  )
);
CREATE POLICY "Users can create own project source files" ON public.source_files FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.source_versions 
    JOIN public.projects ON projects.id = source_versions.project_id
    WHERE source_versions.id = source_files.source_version_id AND projects.owner_id = auth.uid()
  )
);

-- Note: In a real system, the worker will use a service role key to update job statuses, 
-- bypassing these RLS policies.
