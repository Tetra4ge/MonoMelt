const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middlewares/auth.middleware');
const {
  createBlueprint,
  getBlueprints,
  getBlueprintById,
  getBlueprintFiles,
  downloadBlueprint
} = require('../controllers/blueprints.controller');

// All blueprint routes require authentication
router.use(requireAuth);

router.post('/', createBlueprint);
router.get('/', getBlueprints);
router.get('/:blueprintId', getBlueprintById);
router.get('/:blueprintId/files', getBlueprintFiles);
router.get('/:blueprintId/download', downloadBlueprint);

module.exports = router;
