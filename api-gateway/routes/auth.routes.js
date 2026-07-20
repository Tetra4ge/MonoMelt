const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.get('/me', requireAuth, authController.getMe);

module.exports = router;
