const { createClient } = require('@supabase/supabase-js');
const { enqueueReportJob } = require('../services/queue.service');

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

/**
 * GET /api/projects/:projectId/reports
 * Fetches the latest generated report for a specific project
 */
const getLatestReport = async (req, res) => {
    try {
        const { projectId } = req.params;
        const supabase = getSupabaseClient(req);
        
        const { data, error } = await supabase
            .from('project_reports')
            .select('*')
            .eq('project_id', projectId)
            .eq('owner_id', req.user.id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();
            
        // PGRST116 means "No rows found" which is acceptable (just returns null data)
        if (error && error.code !== 'PGRST116') {
            console.error('Fetch Report Error:', error.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch report' });
        }
        
        return res.status(200).json({ success: true, data: data || null });
    } catch (error) {
        console.error('Fetch Report Exception:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/projects/:projectId/reports/generate
 * Queues a new report version (e.g. to retry a failed one).
 */
const generateReport = async (req, res) => {
    try {
        const { projectId } = req.params;
        const supabase = getSupabaseClient(req);

        const { data: latest } = await supabase
            .from('project_reports')
            .select('status')
            .eq('project_id', projectId)
            .eq('owner_id', req.user.id)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latest && (latest.status === 'pending' || latest.status === 'generating')) {
            return res.status(409).json({ success: false, message: 'A report is already being generated.' });
        }

        await enqueueReportJob({ projectId, ownerId: req.user.id });
        return res.status(202).json({ success: true, message: 'Report generation queued.' });
    } catch (error) {
        console.error('Queue Report Exception:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to queue report generation' });
    }
};

module.exports = {
    getLatestReport,
    generateReport
};
