const { createClient } = require('@supabase/supabase-js');

const getSupabaseClient = (req) => {
  const token = req.headers.authorization.split(' ')[1];
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const getJobStatus = async (req, res, next) => {
  try {
    const { projectId, jobId } = req.params;
    const supabase = getSupabaseClient(req);
    const { data: job, error } = await supabase
      .from('analysis_jobs')
      .select('id, status, error_code, created_at, updated_at, source_versions(id, source_type, metadata)')
      .eq('id', jobId)
      .eq('project_id', projectId)
      .single();
    if (error || !job) { return res.status(404).json({ success: false, message: 'Job not found' }); }
    res.status(200).json({ success: true, data: job });
  } catch (error) { next(error); }
};

module.exports = { getJobStatus, getSupabaseClient };
