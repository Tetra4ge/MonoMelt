const { createClient } = require('@supabase/supabase-js');
const { uploadSourceZip } = require('../services/storage.service');
const { enqueueIngestionJob } = require('../services/queue.service');
const { parseGithubImport } = require('../utils/github.util');

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

// If anything after the job row is created fails, mark the job failed so the UI
// does not poll a 'queued' job forever.
const failJob = async (supabase, jobId, error) => {
  await supabase
    .from('analysis_jobs')
    .update({ status: 'failed', error_code: String(error.message || error).slice(0, 500) })
    .eq('id', jobId);
};

const uploadZipSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!req.file) { 
      return res.status(400).json({ success: false, message: 'No file uploaded' }); 
    }
    if (req.file.buffer.length < ZIP_SIGNATURE.length || !req.file.buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
      return res.status(400).json({ success: false, message: 'Uploaded file is not a valid ZIP archive' });
    }

    const supabase = getSupabaseClient(req);

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', req.user.sub)
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

    // Create an ingestion job. Analysis starts only after the worker has created the manifest.
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({ 
        project_id: projectId, 
        source_version_id: sourceVersion.id, 
        status: 'queued'
      })
      .select()
      .single();

    if (jobError) throw jobError;

    try {
      const storagePath = await uploadSourceZip(req.file.buffer, projectId, sourceVersion.id);
      await enqueueIngestionJob({
        projectId, 
        jobId: job.id, 
        sourceVersionId: sourceVersion.id, 
        storagePath,
        ownerId: req.user.sub,
        sourceType: 'zip'
      });
    } catch (queueError) {
      await failJob(supabase, job.id, queueError);
      throw queueError;
    }

    return res.status(202).json({ 
      success: true, 
      data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'queued' }
    });
  } catch (error) { 
    next(error); 
  }
};

const importGithubSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const github = parseGithubImport(req.body.repoUrl, req.body.branch);
    if (github.error) {
      return res.status(400).json({ success: false, message: github.error });
    }
    const { repoUrl, branch } = github;

    const supabase = getSupabaseClient(req);

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', req.user.sub)
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
        metadata: { repoUrl, branch } 
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
        status: 'queued'
      })
      .select()
      .single();

    if (jobError) throw jobError;

    try {
      await enqueueIngestionJob({
        projectId, 
        jobId: job.id, 
        sourceVersionId: sourceVersion.id, 
        repoUrl, 
        branch, 
        ownerId: req.user.sub,
        sourceType: 'github' 
      });
    } catch (queueError) {
      await failJob(supabase, job.id, queueError);
      throw queueError;
    }

    return res.status(202).json({ 
      success: true, 
      data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'queued' }
    });
  } catch (error) { 
    next(error); 
  }
};

module.exports = { uploadZipSource, importGithubSource };
