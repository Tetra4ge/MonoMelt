const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/auth.middleware');
const sourcesController = require('../controllers/sources.controller');

const router = express.Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage() });

router.post('/zip', requireAuth, upload.single('file'), sourcesController.uploadZipSource);
router.post('/github', requireAuth, sourcesController.importGithubSource);

module.exports = router;
