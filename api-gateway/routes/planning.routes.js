const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middlewares/auth.middleware');
const planningController = require('../controllers/planning.controller');

// All planning routes require authentication
router.use(requireAuth);

// List all migration plans for a project
router.get('/', planningController.getPlans);

// Create a new migration plan from a scenario
router.post('/scenarios/:scenarioId/plans', planningController.createPlan);

// Get specific plan details and all its revisions
router.get('/:planId', planningController.getPlanDetails);

// Recalculate plan with updated assumptions (creates new revision)
router.post('/:planId/assumptions', planningController.recalculatePlan);

module.exports = router;
