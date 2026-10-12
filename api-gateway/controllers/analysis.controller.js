const { proxyToAiService } = require('../services/ai.service');

const triggerAnalysis = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('POST', '/analysis/trigger', req.body, { project_id: projectId, owner_id: ownerId });
    res.status(202).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const getAnalysisStatus = async (req, res, next) => {
  try {
    const { projectId, runId } = req.params;
    const result = await proxyToAiService('GET', `/analysis/run/${runId}/status`, null, { project_id: projectId, owner_id: req.user.sub });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const getAnalysisMetrics = async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/metrics`, null, { project_id: projectId, owner_id: ownerId });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const getAnalysisGraph = async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;
    const { depth = 2, cursor, limit = 100 } = req.query;
    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/graph`, null, { project_id: projectId, owner_id: ownerId, depth, cursor, limit });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const getAnalysisDiagnostics = async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/diagnostics`, null, { project_id: projectId, owner_id: ownerId });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

module.exports = { triggerAnalysis, getAnalysisStatus, getAnalysisMetrics, getAnalysisGraph, getAnalysisDiagnostics };
