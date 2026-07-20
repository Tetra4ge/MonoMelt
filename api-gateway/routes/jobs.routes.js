const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const jobsController = require('../controllers/jobs.controller');

const router = express.Router({ mergeParams: true });

router.get('/:jobId', requireAuth, jobsController.getJobStatus);

module.exports = router;
