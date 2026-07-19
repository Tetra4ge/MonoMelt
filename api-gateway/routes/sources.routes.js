const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/auth.middleware');
const { createClient } = require('@supabase/supabase-js');
const { uploadSourceZip } = require('../services/storage.service');
const { enqueueIngestionJob } = require('../services/queue.service');

const router = express.Router({ mergeParams: true }); // to access :projectId

// Multer setup - store in memory buffer for immediate processing/upload
const upload = multer({
  storage: multer.memoryStorage(),
  // No file size limits as per user requirement "No limit"
});

// Helper for supabase client as the user
const getSupabaseClient = (req) => {
  const token = req.headers.authorization.split(' ')[1];
  return createClient(process.env.SUPABASE_URL, token, {
    global: {
      headers: { Authorization: req.headers.authorization }
    }
  });
};

/**
 * POST /api/projects/:projectId/sources/zip
 * Upload a ZIP file for ingestion
 */
router.post('/zip', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    if (req.file.mimetype !== 'application/zip' && req.file.mimetype !== 'application/x-zip-compressed') {
      return res.status(400).json({ success: false, message: 'File must be a ZIP archive' });
    }

    const supabase = getSupabaseClient(req);

    // 1. Verify project ownership (already implicitly done via RLS but good to check if project exists)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();
      
    if (projectError || !project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 2. Create source_version
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

    // 3. Create analysis_job
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

    // 4. Upload zip to storage
    const storagePath = await uploadSourceZip(req.file.buffer, projectId, job.id);

    // 5. Enqueue background task
    await enqueueIngestionJob({
      projectId,
      jobId: job.id,
      sourceVersionId: sourceVersion.id,
      storagePath,
      sourceType: 'zip'
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        sourceVersionId: sourceVersion.id,
        status: 'queued'
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:projectId/sources/github
 * Import from a GitHub repository
 */
router.post('/github', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { repoUrl, branch } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ success: false, message: 'repoUrl is required' });
    }

    const supabase = getSupabaseClient(req);

    // 1. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();
      
    if (projectError || !project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 2. Create source_version
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

    // 3. Create analysis_job
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

    // 4. Enqueue background task (worker will handle fetching github)
    await enqueueIngestionJob({
      projectId,
      jobId: job.id,
      sourceVersionId: sourceVersion.id,
      repoUrl,
      branch: branch || 'main',
      sourceType: 'github'
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        sourceVersionId: sourceVersion.id,
        status: 'queued'
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
