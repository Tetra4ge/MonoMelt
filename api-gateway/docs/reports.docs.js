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
 */
module.exports = {};
