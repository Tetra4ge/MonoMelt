/**
 * @swagger
 * /api/projects/{projectId}/reports:
 *   get:
 *     summary: Get Latest Project Report
 *     description: Fetches the most recently generated architecture transformation report for a specific project. Used for initial frontend page load before WebSocket events.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the project.
 *     responses:
 *       200:
 *         description: Successfully retrieved the latest report or null if none exists yet.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   nullable: true
 *       500:
 *         description: Server error occurred while fetching the report.
 *
 * /api/projects/{projectId}/reports/generate:
 *   post:
 *     summary: Queue a new report version
 *     description: Queues report generation for the project (for example to retry a failed report). Rejected while a report is already generating.
 *     tags: [Reports]
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
 *       202:
 *         description: Report generation queued.
 *       409:
 *         description: A report is already being generated.
 *
 * /api/projects/{projectId}/reports/export/notion:
 *   post:
 *     summary: Export Report to Notion
 *     description: >
 *       Exports the latest completed report to a Notion workspace via the MCP server.
 *       Idempotent — if the report has already been exported, returns the existing Notion URL
 *       without creating a duplicate page.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the project whose report to export.
 *     responses:
 *       200:
 *         description: Report successfully exported to Notion (or already exported).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Already exported.
 *                 notion_url:
 *                   type: string
 *                   format: uri
 *                   example: https://www.notion.so/MonoMelt-Report-abc123
 *       404:
 *         description: No completed report found for this project.
 *       429:
 *         description: Notion API rate limit exceeded after retries.
 *       500:
 *         description: MCP server unreachable or internal error.
 */
module.exports = {};
