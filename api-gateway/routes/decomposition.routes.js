const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middlewares/auth.middleware');
const decompositionController = require('../controllers/decomposition.controller');

// All routes require authentication
router.use(requireAuth);

// List all scenarios for a project
router.get('/', decompositionController.getScenarios);

// Trigger a new scenario generation
router.post('/', decompositionController.triggerGeneration);
router.post('/generate', decompositionController.triggerGeneration);

// Get specific scenario with its revisions and services
router.get('/:scenarioId', decompositionController.getScenarioDetails);

// Save a new revision (user edited boundaries)
router.post('/:scenarioId/revisions', decompositionController.createRevision);

module.exports = router;
