/**
 * @swagger
 * tags:
 *   name: Analysis
 *   description: AI Analysis and Dependency Graph endpoints
 * 
 * /api/projects/{projectId}/analysis/trigger:
 *   post:
 *     summary: Trigger the AST parsing and AI analysis pipeline
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Analysis job triggered successfully
 * 
 * /api/projects/{projectId}/analysis/{sourceVersionId}/graph:
 *   get:
 *     summary: Fetch the Neo4j dependency graph
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sourceVersionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: depth
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Graph nodes and edges returned
 * 
 * /api/projects/{projectId}/analysis/{sourceVersionId}/metrics:
 *   get:
 *     summary: Fetch high-level code metrics (file count, languages)
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sourceVersionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 * 
 * /api/projects/{projectId}/analysis/run/{runId}/status:
 *   get:
 *     summary: Poll the status of an analysis run
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: runId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 * 
 * /api/projects/{projectId}/analysis/{sourceVersionId}/diagnostics:
 *   get:
 *     summary: Fetch parser diagnostics and warnings
 *     tags: [Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: sourceVersionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Diagnostics retrieved successfully
 */
