const { createClient } = require('@supabase/supabase-js');
const { uploadSourceZip } = require('../services/storage.service');
const { enqueueIngestionJob } = require('../services/queue.service');
const { proxyToAiService } = require('../services/ai.service');

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const uploadZipSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!req.file) { 
      return res.status(400).json({ success: false, message: 'No file uploaded' }); 
    }

    const supabase = getSupabaseClient(req);

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) { 
      return res.status(404).json({ success: false, message: 'Project not found' }); 
    }

    // Insert source version
    const { data: sourceVersion, error: svError } = await supabase
      .from('source_versions')
      .insert({ 
        project_id: projectId, 
        source_type: 'zip', 
        metadata: { filename: req.file.originalname, size: req.file.size } 
      })
      .select()
      .single();

    if (svError) throw svError;

    // Create analysis job with analyzing status
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({ 
        project_id: projectId, 
        source_version_id: sourceVersion.id, 
        status: 'analyzing' 
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Optional background storage & queue tasks
    uploadSourceZip(req.file.buffer, projectId, job.id).catch(err => {
      console.warn('Storage upload notice:', err.message);
    });

    enqueueIngestionJob({ 
      projectId, 
      jobId: job.id, 
      sourceVersionId: sourceVersion.id, 
      sourceType: 'zip' 
    }).catch(err => {
      console.warn('Queue enqueue notice:', err.message);
    });

    // Trigger AI service AST analysis pipeline in background
    const ownerId = req.user?.sub || 'dc035a11-d7ca-47b5-a2ab-865714d71cd4';
    proxyToAiService('POST', '/analysis/trigger', {
      source_version_id: sourceVersion.id
    }, { project_id: projectId, owner_id: ownerId }).catch(err => {
      console.warn('Analysis trigger notice:', err.message);
    });

    return res.status(202).json({ 
      success: true, 
      data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'analyzing' } 
    });
  } catch (error) { 
    next(error); 
  }
};

const importGithubSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { repoUrl, branch } = req.body;
    
    if (!repoUrl) { 
      return res.status(400).json({ success: false, message: 'Repository URL is required' }); 
    }

    const supabase = getSupabaseClient(req);

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) { 
      return res.status(404).json({ success: false, message: 'Project not found' }); 
    }

    // Insert source version
    const { data: sourceVersion, error: svError } = await supabase
      .from('source_versions')
      .insert({ 
        project_id: projectId, 
        source_type: 'github', 
        metadata: { repoUrl, branch: branch || 'main' } 
      })
      .select()
      .single();

    if (svError) throw svError;

    // Create analysis job with analyzing status
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({ 
        project_id: projectId, 
        source_version_id: sourceVersion.id, 
        status: 'analyzing' 
      })
      .select()
      .single();

    if (jobError) throw jobError;

    enqueueIngestionJob({ 
      projectId, 
      jobId: job.id, 
      sourceVersionId: sourceVersion.id, 
      repoUrl, 
      branch: branch || 'main', 
      sourceType: 'github' 
    }).catch(err => {
      console.warn('Queue enqueue notice:', err.message);
    });

    // Trigger AI service AST analysis pipeline in background
    const ownerId = req.user?.sub || 'dc035a11-d7ca-47b5-a2ab-865714d71cd4';
    proxyToAiService('POST', '/analysis/trigger', {
      source_version_id: sourceVersion.id
    }, { project_id: projectId, owner_id: ownerId }).catch(err => {
      console.warn('Analysis trigger notice:', err.message);
    });

    return res.status(202).json({ 
      success: true, 
      data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'analyzing' } 
    });
  } catch (error) { 
    next(error); 
  }
};

module.exports = { uploadZipSource, importGithubSource };
