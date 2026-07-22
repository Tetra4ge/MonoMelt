const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middlewares/auth.middleware');
const sourcesController = require('../controllers/sources.controller');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024) },
  fileFilter: (req, file, callback) => {
    const isZip = file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || /\.zip$/i.test(file.originalname);
    callback(isZip ? null : new Error('Only ZIP archives are accepted'), isZip);
  },
});

router.post('/zip', requireAuth, upload.single('file'), sourcesController.uploadZipSource);
router.post('/github', requireAuth, sourcesController.importGithubSource);

module.exports = router;
