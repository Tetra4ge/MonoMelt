const { proxyToAiService } = require('../services/ai.service');

const triggerIntelligence = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('POST', '/intelligence/trigger', req.body, { project_id: projectId, owner_id: ownerId });
    res.status(202).json(result);
  } catch (error) { next(error); }
};

const getIntelligenceFindings = async (req, res, next) => {
  try {
    const { projectId, sourceVersionId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('GET', `/intelligence/${sourceVersionId}/findings`, null, { project_id: projectId, owner_id: ownerId });
    res.json(result);
  } catch (error) { next(error); }
};

const reviewFinding = async (req, res, next) => {
  try {
    const { projectId, findingId } = req.params;
    const ownerId = req.user.sub;
    const result = await proxyToAiService('POST', `/intelligence/findings/${findingId}/review`, req.body, { project_id: projectId, owner_id: ownerId });
    res.json(result);
  } catch (error) { next(error); }
};

module.exports = { triggerIntelligence, getIntelligenceFindings, reviewFinding };
