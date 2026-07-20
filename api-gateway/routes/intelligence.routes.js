const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const intelligenceController = require('../controllers/intelligence.controller');

const router = express.Router({ mergeParams: true });

router.post('/trigger', requireAuth, intelligenceController.triggerIntelligence);
router.get('/:sourceVersionId/findings', requireAuth, intelligenceController.getIntelligenceFindings);
router.post('/findings/:findingId/review', requireAuth, intelligenceController.reviewFinding);

module.exports = router;
