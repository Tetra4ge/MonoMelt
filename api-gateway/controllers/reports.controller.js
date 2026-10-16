const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { enqueueReportJob } = require('../services/queue.service');
const { buildNotionPayload, convertToNativeNotionBlocks } = require('../utils/notion.util');
const { retryWithBackoff } = require('../utils/retry.util');

const MCP_SERVER_URL = process.env.MCP_NOTION_SERVER_URL || 'http://localhost:3001/mcp/notion';

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
        return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to queue report generation' });
    }
};

/**
 * POST /api/projects/:projectId/reports/export/notion
 * Exports the latest completed report to a Notion workspace via the MCP server.
 *
 * Idempotent: if the report already has a `notion_url`, returns it immediately
 * without creating a duplicate page.
 */
const exportReportToNotion = async (req, res) => {
    try {
        const { projectId } = req.params;
        const supabase = getSupabaseClient(req);

        // 1. Fetch the latest completed report for this project + owner.
        const { data: report, error } = await supabase
            .from('project_reports')
            .select('*')
            .eq('project_id', projectId)
            .eq('owner_id', req.user.id)
            .eq('status', 'completed')
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        if (error || !report) {
            return res.status(404).json({
                success: false,
                message: 'No completed report found for this project.',
            });
        }

        // 2. Idempotency guard — already exported.
        if (report.notion_url) {
            return res.status(200).json({
                success: true,
                message: 'Already exported.',
                notion_url: report.notion_url,
            });
        }

        // 3. Translate JSON payload to Notion blocks.
        const mcpPayload = buildNotionPayload(report.payload, projectId);
        let newNotionUrl = null;

        // 4. Dispatch directly to Notion API if credentials are present, else fallback to MCP server.
        if (process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID) {
            console.log(`[API Gateway] Exporting report ${report.id} directly to Notion API...`);
            const nativeBlocks = convertToNativeNotionBlocks(mcpPayload.blocks);
            const notionRes = await retryWithBackoff(
                () => axios.post('https://api.notion.com/v1/pages', {
                    parent: { database_id: process.env.NOTION_DATABASE_ID },
                    properties: {
                        Report: {
                            title: [{ type: 'text', text: { content: mcpPayload.title || `MonoMelt Report: ${projectId.slice(0, 8)}` } }],
                        },
                        Revision: {
                            rich_text: [{ type: 'text', text: { content: `v${report.version_number || 1}` } }],
                        },
                        'Generated at': {
                            date: { start: report.created_at || new Date().toISOString() },
                        },
                    },
                    children: nativeBlocks,
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                        'Notion-Version': '2022-06-28',
                        'Content-Type': 'application/json',
                    },
                }),
                { maxRetries: 3, baseDelayMs: 500, retryOn: [429] }
            );
            newNotionUrl = notionRes.data?.url;
        } else {
            console.log(`[API Gateway] Dispatching report ${report.id} to Notion MCP at ${MCP_SERVER_URL}...`);
            const mcpResponse = await retryWithBackoff(
                () => axios.post(`${MCP_SERVER_URL}/pages`, {
                    database_id: process.env.NOTION_DATABASE_ID,
                    ...mcpPayload,
                }),
                { maxRetries: 3, baseDelayMs: 500, retryOn: [429] }
            );
            newNotionUrl = mcpResponse.data?.page_url;
        }

        // 5. Persist the Notion URL back into Supabase.
        await supabase
            .from('project_reports')
            .update({ notion_url: newNotionUrl })
            .eq('id', report.id);

        console.log(`[API Gateway] Report ${report.id} exported to Notion: ${newNotionUrl}`);

        return res.status(200).json({
            success: true,
            notion_url: newNotionUrl,
        });
    } catch (err) {
        console.error('[API Gateway] Notion Export Failed:', err.message);

        // Surface the MCP status if it was a rate-limit or known HTTP error.
        const status = err?.response?.status;
        if (status === 429) {
            return res.status(429).json({
                success: false,
                message: 'Notion API rate limit exceeded. Please try again later.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to export report to Notion. The MCP server may be unavailable.',
        });
    }
};

module.exports = {
    getLatestReport,
    generateReport,
    exportReportToNotion,
};
