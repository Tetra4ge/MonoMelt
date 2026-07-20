/**
 * @swagger
 * tags:
 *   name: Decomposition
 *   description: API for managing Phase 5 microservice decomposition scenarios
 */

/**
 * @swagger
 * /api/projects/{projectId}/scenarios:
 *   post:
 *     summary: Generate a new decomposition scenario
 *     tags: [Decomposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source_version_id
 *               - strategy_type
 *             properties:
 *               source_version_id:
 *                 type: string
 *                 format: uuid
 *               strategy_type:
 *                 type: string
 *                 enum: [conservative, aggressive, domain, team]
 *     responses:
 *       202:
 *         description: Scenario generation started
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/projects/{projectId}/scenarios:
 *   get:
 *     summary: List all decomposition scenarios for a project
 *     tags: [Decomposition]
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
 *         description: List of scenarios
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/projects/{projectId}/scenarios/{scenarioId}:
 *   get:
 *     summary: Get a specific scenario, its revisions, and proposed services
 *     tags: [Decomposition]
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
 *     responses:
 *       200:
 *         description: Scenario details
 *       404:
 *         description: Scenario not found
 */

/**
 * @swagger
 * /api/projects/{projectId}/scenarios/{scenarioId}/revisions:
 *   post:
 *     summary: Create a new revision for a scenario (User edit)
 *     tags: [Decomposition]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - services
 *             properties:
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     assigned_nodes:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: New revision created
 *       400:
 *         description: Invalid input
 */
