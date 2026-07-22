/**
 * @swagger
 * /api/projects/{projectId}/deployments:
 *   post:
 *     summary: Start persisted blueprint deployment simulation
 *     tags: [Deployments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [blueprintId]
 *             properties:
 *               blueprintId: { type: string, format: uuid }
 *     responses:
 *       202: { description: Deployment simulation started }
 * /api/projects/{projectId}/deployments/{deploymentId}:
 *   get:
 *     summary: Get persisted deployment status and logs
 *     tags: [Deployments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: projectId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: deploymentId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deployment status }
 */
