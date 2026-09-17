const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { getLatestReport } = require('../controllers/reports.controller');

const router = express.Router({ mergeParams: true });

// Apply JWT Authentication middleware
router.use(requireAuth);

router.get('/', getLatestReport);

module.exports = router;
