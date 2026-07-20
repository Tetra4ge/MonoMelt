/**
 * Analysis Routes (API Gateway)
 * =============================
 * Proxy layer between the frontend and the AI analysis service.
 * All requests are authenticated via requireAuth before forwarding.
 *
 * Routes:
 *   POST   /api/projects/:projectId/analysis/trigger
 *   GET    /api/projects/:projectId/analysis/run/:runId/status
 *   GET    /api/projects/:projectId/analysis/:sourceVersionId/metrics
 *   GET    /api/projects/:projectId/analysis/:sourceVersionId/graph
 *   GET    /api/projects/:projectId/analysis/:sourceVersionId/diagnostics
 */

const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { proxyToAiService } = require('../services/ai.service');

const router = express.Router({ mergeParams: true });

/**
 * POST /api/projects/:projectId/analysis/trigger
 * Trigger the analysis pipeline for a given source version.
 */
router.post('/trigger', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const ownerId = req.user.sub;

    const result = await proxyToAiService('POST', '/analysis/trigger', req.body, {
      project_id: projectId,
      owner_id: ownerId,
    });

    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/analysis/run/:runId/status
 * Poll the status of an analysis run.
 */
router.get('/run/:runId/status', requireAuth, async (req, res, next) => {
  try {
    const { runId } = req.params;
    const result = await proxyToAiService('GET', `/analysis/run/${runId}/status`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/analysis/:sourceVersionId/metrics
 */
router.get('/:sourceVersionId/metrics', requireAuth, async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;

    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/metrics`, null, {
      project_id: projectId,
      owner_id: ownerId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/analysis/:sourceVersionId/graph
 */
router.get('/:sourceVersionId/graph', requireAuth, async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;
    const { depth = 2, cursor, limit = 100 } = req.query;

    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/graph`, null, {
      project_id: projectId,
      owner_id: ownerId,
      depth,
      cursor,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:projectId/analysis/:sourceVersionId/diagnostics
 */
router.get('/:sourceVersionId/diagnostics', requireAuth, async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;

    const result = await proxyToAiService('GET', `/analysis/${sourceVersionId}/diagnostics`, null, {
      project_id: projectId,
      owner_id: ownerId,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
