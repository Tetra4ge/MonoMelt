const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const projectsController = require('../controllers/projects.controller');

const router = express.Router();

router.get('/', requireAuth, projectsController.getAllProjects);
router.get('/:projectId', requireAuth, projectsController.getProjectById);
router.post('/', requireAuth, projectsController.createProject);

const sourcesRouter = require('./sources.routes');
const jobsRouter = require('./jobs.routes');

router.use('/:projectId/sources', sourcesRouter);
router.use('/:projectId/jobs', jobsRouter);

module.exports = router;
