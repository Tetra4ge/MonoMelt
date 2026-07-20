/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Background Job Tracking endpoints
 * 
 * /api/projects/{projectId}/jobs/{jobId}:
 *   get:
 *     summary: Get the status of an ingestion or analysis job
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved successfully (queued, ingesting, ready, failed)
 *       404:
 *         description: Job not found
 */
