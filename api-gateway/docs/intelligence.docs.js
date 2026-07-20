/**
 * @swagger
 * tags:
 *   name: Intelligence
 *   description: Endpoints for Phase 4 AI enrichment and findings
 */

/**
 * @swagger
 * /api/projects/{projectId}/intelligence/trigger:
 *   post:
 *     summary: Trigger AI enrichment pipeline
 *     description: Starts the asynchronous LLM enrichment tasks for a completed project analysis run.
 *     tags: [Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the project
 *     responses:
 *       202:
 *         description: Intelligence pipeline triggered successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /api/projects/{projectId}/intelligence/{sourceVersionId}/findings:
 *   get:
 *     summary: Get AI findings
 *     description: Retrieves the LLM-generated findings (domains, risks, sensitivity) for a specific source version.
 *     tags: [Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the project
 *       - in: path
 *         name: sourceVersionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the source version
 *     responses:
 *       200:
 *         description: Successfully retrieved findings
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /api/projects/{projectId}/intelligence/findings/{findingId}/review:
 *   post:
 *     summary: Review an AI finding
 *     description: Accepts, rejects, or annotates a specific AI finding (human-in-the-loop validation).
 *     tags: [Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the project
 *       - in: path
 *         name: findingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the finding to review
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               review_status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: The new status of the finding
 *     responses:
 *       200:
 *         description: Successfully updated review status
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal Server Error
 */
