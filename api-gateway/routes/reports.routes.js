const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { getLatestReport, generateReport, exportReportToNotion } = require('../controllers/reports.controller');

const router = express.Router({ mergeParams: true });

// Apply JWT Authentication middleware
router.use(requireAuth);

router.get('/', getLatestReport);
router.post('/generate', generateReport);
router.post('/export/notion', exportReportToNotion);

module.exports = router;

