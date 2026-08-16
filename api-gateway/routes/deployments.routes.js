const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/deployments.controller');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);
router.post('/', controller.startDeployment);
router.get('/:deploymentId', controller.getDeployment);
router.get('/:deploymentId/services', controller.getServiceHealth);
module.exports = router;
