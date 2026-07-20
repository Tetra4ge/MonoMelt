const { createClient } = require('@supabase/supabase-js');
const { uploadSourceZip } = require('../services/storage.service');
const { enqueueIngestionJob } = require('../services/queue.service');

const getSupabaseClient = (req) => {
  const token = req.headers.authorization.split(' ')[1];
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const uploadZipSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!req.file) { return res.status(400).json({ success: false, message: 'No file uploaded' }); }
    if (req.file.mimetype !== 'application/zip' && req.file.mimetype !== 'application/x-zip-compressed') {
      return res.status(400).json({ success: false, message: 'File must be a ZIP archive' });
    }
    const supabase = getSupabaseClient(req);
    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) { return res.status(404).json({ success: false, message: 'Project not found' }); }
    const { data: sourceVersion, error: svError } = await supabase.from('source_versions').insert({ project_id: projectId, source_type: 'zip', metadata: { filename: req.file.originalname, size: req.file.size } }).select().single();
    if (svError) throw svError;
    const { data: job, error: jobError } = await supabase.from('analysis_jobs').insert({ project_id: projectId, source_version_id: sourceVersion.id, status: 'queued' }).select().single();
    if (jobError) throw jobError;
    const storagePath = await uploadSourceZip(req.file.buffer, projectId, job.id);
    await enqueueIngestionJob({ projectId, jobId: job.id, sourceVersionId: sourceVersion.id, storagePath, sourceType: 'zip' });
    res.status(202).json({ success: true, data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'queued' } });
  } catch (error) { next(error); }
};

const importGithubSource = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { repoUrl, branch } = req.body;
    if (!repoUrl) { return res.status(400).json({ success: false, message: 'repoUrl is required' }); }
    const supabase = getSupabaseClient(req);
    const { data: project, error: projectError } = await supabase.from('projects').select('id').eq('id', projectId).single();
    if (projectError || !project) { return res.status(404).json({ success: false, message: 'Project not found' }); }
    const { data: sourceVersion, error: svError } = await supabase.from('source_versions').insert({ project_id: projectId, source_type: 'github', metadata: { repoUrl, branch: branch || 'main' } }).select().single();
    if (svError) throw svError;
    const { data: job, error: jobError } = await supabase.from('analysis_jobs').insert({ project_id: projectId, source_version_id: sourceVersion.id, status: 'queued' }).select().single();
    if (jobError) throw jobError;
    await enqueueIngestionJob({ projectId, jobId: job.id, sourceVersionId: sourceVersion.id, repoUrl, branch: branch || 'main', sourceType: 'github' });
    res.status(202).json({ success: true, data: { jobId: job.id, sourceVersionId: sourceVersion.id, status: 'queued' } });
  } catch (error) { next(error); }
};

module.exports = { uploadZipSource, importGithubSource };
