/**
 * @swagger
 * tags:
 *   name: Sources
 *   description: Codebase Ingestion and Upload endpoints
 * 
 * /api/projects/{projectId}/sources/zip:
 *   post:
 *     summary: Upload a ZIP file containing the monolith codebase
 *     tags: [Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: File accepted and ingestion job queued
 *       400:
 *         description: Invalid file type or missing file
 * 
 * /api/projects/{projectId}/sources/github:
 *   post:
 *     summary: Import codebase directly from a GitHub repository
 *     tags: [Sources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repoUrl:
 *                 type: string
 *               branch:
 *                 type: string
 *     responses:
 *       202:
 *         description: GitHub import job queued
 */
