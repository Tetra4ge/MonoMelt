/**
 * @openapi
 * components:
 *   schemas:
 *     ArtifactFile:
 *       type: object
 *       properties:
 *         path:
 *           type: string
 *           example: "blueprint/services/user-service/Dockerfile"
 *         sha256:
 *           type: string
 *           example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *         size_bytes:
 *           type: integer
 *           example: 245
 *         content_type:
 *           type: string
 *           example: "text/plain"
 *     BlueprintManifest:
 *       type: object
 *       properties:
 *         generator_version:
 *           type: string
 *           example: "1.0.0"
 *         project_id:
 *           type: string
 *           format: uuid
 *         scenario_revision_id:
 *           type: string
 *           format: uuid
 *         plan_revision_id:
 *           type: string
 *           format: uuid
 *         version_number:
 *           type: integer
 *           example: 1
 *         artifacts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ArtifactFile'
 *         warnings:
 *           type: array
 *           items:
 *             type: string
 *         validation_results:
 *           type: object
 *           additionalProperties:
 *             type: boolean
 *     BlueprintResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             project_id:
 *               type: string
 *               format: uuid
 *             version_number:
 *               type: integer
 *             status:
 *               type: string
 *               example: "completed"
 *             manifest:
 *               $ref: '#/components/schemas/BlueprintManifest'
 *             artifact_path:
 *               type: string
 *             created_at:
 *               type: string
 *               format: date-time
 * 
 * /api/projects/{projectId}/blueprints:
 *   post:
 *     summary: Generate a versioned architecture blueprint package
 *     tags: [Architecture Blueprints]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               - scenarioRevisionId
 *               - planRevisionId
 *             properties:
 *               scenarioRevisionId:
 *                 type: string
 *                 format: uuid
 *               planRevisionId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Blueprint generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlueprintResponse'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 * 
 *   get:
 *     summary: List all generated blueprints for a project
 *     tags: [Architecture Blueprints]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of versioned blueprints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlueprintResponse'
 * 
 * /api/projects/{projectId}/blueprints/{blueprintId}:
 *   get:
 *     summary: Fetch detailed blueprint record and manifest
 *     tags: [Architecture Blueprints]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Blueprint manifest details
 * 
 * /api/projects/{projectId}/blueprints/{blueprintId}/download:
 *   get:
 *     summary: Download architecture blueprint ZIP package
 *     tags: [Architecture Blueprints]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Download ZIP archive package
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 */
