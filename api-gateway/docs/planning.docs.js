/**
 * @swagger
 * tags:
 *   name: Planning
 *   description: API for managing Phase 6 migration plans and reports
 */

/**
 * @swagger
 * /api/projects/{projectId}/scenarios/{scenarioId}/plans:
 *   post:
 *     summary: Create a new migration plan for a scenario
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: scenarioId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               assumptions:
 *                 type: object
 *                 properties:
 *                   cloud_provider:
 *                     type: string
 *                     enum: [aws, azure, gcp]
 *                   pricing_region:
 *                     type: string
 *                   cost_multiplier:
 *                     type: number
 *                   team_count:
 *                     type: integer
 *                   risk_tolerance:
 *                     type: string
 *                     enum: [low, medium, high]
 *                   migration_window_months:
 *                     type: integer
 *     responses:
 *       201:
 *         description: Migration plan created successfully
 *       400:
 *         description: Invalid input or scenario revision missing
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/projects/{projectId}/plans:
 *   get:
 *     summary: List all migration plans for a project
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of migration plans
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/projects/{projectId}/plans/{planId}:
 *   get:
 *     summary: Get details of a specific migration plan and its revisions
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Migration plan details and latest revision
 *       404:
 *         description: Migration plan not found
 */

/**
 * @swagger
 * /api/projects/{projectId}/plans/{planId}/assumptions:
 *   post:
 *     summary: Recalculate a migration plan with updated assumptions (Creates new revision)
 *     tags: [Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assumptions
 *             properties:
 *               assumptions:
 *                 type: object
 *     responses:
 *       200:
 *         description: Recalculated plan revision created
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Migration plan not found
 */
