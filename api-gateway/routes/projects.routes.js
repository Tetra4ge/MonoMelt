const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

// Get all projects for user
router.get('/', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: [] // TODO: DB integration
  });
});

// Get project by ID
router.get('/:projectId', requireAuth, (req, res) => {
  const { projectId } = req.params;
  res.status(200).json({
    success: true,
    data: { id: projectId, owner_id: req.user.sub }
  });
});

// Create project
router.post('/', requireAuth, (req, res) => {
  res.status(201).json({
    success: true,
    data: { id: 'temp-id', ...req.body, owner_id: req.user.sub }
  });
});

module.exports = router;
