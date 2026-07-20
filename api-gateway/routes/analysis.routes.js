const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const analysisController = require('../controllers/analysis.controller');

const router = express.Router({ mergeParams: true });

router.post('/trigger', requireAuth, analysisController.triggerAnalysis);
router.get('/run/:runId/status', requireAuth, analysisController.getAnalysisStatus);
router.get('/:sourceVersionId/metrics', requireAuth, analysisController.getAnalysisMetrics);
router.get('/:sourceVersionId/graph', requireAuth, analysisController.getAnalysisGraph);
router.get('/:sourceVersionId/diagnostics', requireAuth, analysisController.getAnalysisDiagnostics);

module.exports = router;
