const { createClient } = require('@supabase/supabase-js');
const { proxyToAiService } = require('../services/ai.service');
const { UUID_RE } = require('../middlewares/project.middleware');

// Service-role client. Every query below filters by the project id; the caller's
// ownership of that project is enforced upstream by requireProjectOwner.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PLAN_COLUMNS = 'id, plan_id, revision_number, is_selected, assumptions, roadmap, consistency_security, cost_performance, team_mapping, created_at';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/** Latest revision of a scenario plus its proposed services. */
async function loadScenarioServices(scenarioId) {
  const { data: revisions, error } = await supabase
    .from('scenario_revisions')
    .select('id')
    .eq('scenario_id', scenarioId)
    .order('revision_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!revisions || revisions.length === 0) return { revisionId: null, services: [] };

  const revisionId = revisions[0].id;
  const { data: services, error: servicesError } = await supabase
    .from('proposed_services')
    .select('*')
    .eq('revision_id', revisionId);
  if (servicesError) throw servicesError;
  return { revisionId, services: services || [] };
}

/**
 * The frontend sends a scenario id; older callers sent a scenario *revision* id
 * under the same name. Accept either, as long as it belongs to this project.
 */
async function resolveScenario(projectId, id) {
  const { data: scenario, error } = await supabase
    .from('decomposition_scenarios')
    .select('id, status')
    .eq('id', id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  if (scenario) return scenario;

  const { data: revision, error: revisionError } = await supabase
    .from('scenario_revisions')
    .select('scenario_id, decomposition_scenarios!inner(id, status, project_id)')
    .eq('id', id)
    .eq('decomposition_scenarios.project_id', projectId)
    .maybeSingle();
  if (revisionError) throw revisionError;
  return revision ? revision.decomposition_scenarios : null;
}

const createPlan = async (req, res) => {
  const { projectId } = req.params;
  const scenarioRef = req.params.scenarioId || req.body.scenarioId || req.body.scenarioRevisionId;
  const { title, assumptions } = req.body;

  if (!scenarioRef) return fail(res, 400, 'A scenario id is required to generate a plan.');

  try {
    const scenario = await resolveScenario(projectId, scenarioRef);
    if (!scenario) return fail(res, 404, 'Scenario not found for this project.');
    if (scenario.status !== 'completed') return fail(res, 409, `Scenario is ${scenario.status}; wait for it to complete.`);

    const { revisionId, services } = await loadScenarioServices(scenario.id);
    if (!revisionId || services.length === 0) {
      return fail(res, 409, 'This scenario has no proposed services to plan for.');
    }

    const planData = await proxyToAiService('POST', '/api/planning/generate', {
      scenario_revision_id: revisionId,
      proposed_services: services,
      assumptions: assumptions || {},
    });

    const { data: plan, error: planError } = await supabase
      .from('migration_plans')
      .insert({
        project_id: projectId,
        scenario_revision_id: revisionId,
        owner_id: req.user.sub,
        title: title || 'Microservice Migration Plan',
        status: 'completed',
      })
      .select()
      .single();
    if (planError) throw planError;

    const { data: revision, error: revisionError } = await supabase
      .from('plan_revisions')
      .insert({
        plan_id: plan.id,
        revision_number: 1,
        is_selected: true,
        assumptions: planData.assumptions || {},
        roadmap: planData.roadmap || {},
        consistency_security: planData.consistency_security || {},
        cost_performance: planData.cost_performance || {},
        team_mapping: planData.team_mapping || {},
      })
      .select()
      .single();
    if (revisionError) {
      await supabase.from('migration_plans').delete().eq('id', plan.id); // don't leave an empty plan behind
      throw revisionError;
    }

    res.status(201).json({
      success: true,
      data: { ...plan, revisions: [revision], latest_revision: revision, plan_revisions: [revision] },
    });
  } catch (err) {
    console.error('createPlan error:', err.message);
    fail(res, err.statusCode || 500, `Failed to create migration plan: ${err.message}`);
  }
};

const getPlans = async (req, res) => {
  const { projectId } = req.params;
  try {
    const { data, error } = await supabase
      .from('migration_plans')
      .select(`*, plan_revisions (${PLAN_COLUMNS})`)
      .eq('project_id', projectId)
      .eq('owner_id', req.user.sub)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('getPlans error:', err.message);
    fail(res, 500, 'Failed to load migration plans.');
  }
};

const getPlanDetails = async (req, res) => {
  const { projectId, planId } = req.params;
  if (!UUID_RE.test(planId)) return fail(res, 404, 'Migration plan not found');
  try {
    const { data: plan, error } = await supabase
      .from('migration_plans')
      .select('*')
      .eq('id', planId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    if (!plan) return fail(res, 404, 'Migration plan not found');

    const { data: revisions, error: revError } = await supabase
      .from('plan_revisions')
      .select('*')
      .eq('plan_id', planId)
      .order('revision_number', { ascending: false });
    if (revError) throw revError;

    res.json({
      success: true,
      data: { ...plan, revisions: revisions || [], latest_revision: revisions && revisions.length > 0 ? revisions[0] : null },
    });
  } catch (err) {
    console.error('getPlanDetails error:', err.message);
    fail(res, 500, 'Failed to load migration plan.');
  }
};

const recalculatePlan = async (req, res) => {
  const { projectId, planId } = req.params;
  const { assumptions } = req.body;
  if (!UUID_RE.test(planId)) return fail(res, 404, 'Migration plan not found');

  try {
    const { data: plan, error: planError } = await supabase
      .from('migration_plans')
      .select('*')
      .eq('id', planId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return fail(res, 404, 'Migration plan not found');
    if (!plan.scenario_revision_id) return fail(res, 409, 'The scenario this plan was built from no longer exists.');

    // The planning engine needs the real services; without them it invents placeholder ones.
    const { data: services, error: servicesError } = await supabase
      .from('proposed_services')
      .select('*')
      .eq('revision_id', plan.scenario_revision_id);
    if (servicesError) throw servicesError;
    if (!services || services.length === 0) return fail(res, 409, 'The scenario has no proposed services to plan for.');

    const aiResponse = await proxyToAiService('POST', '/api/planning/recalculate', {
      scenario_revision_id: plan.scenario_revision_id,
      proposed_services: services,
      assumptions: assumptions || {},
    });

    const { data: latest } = await supabase
      .from('plan_revisions')
      .select('revision_number')
      .eq('plan_id', planId)
      .order('revision_number', { ascending: false })
      .limit(1);
    const nextNumber = (latest && latest.length > 0 ? latest[0].revision_number : 0) + 1;

    const { error: insertError } = await supabase.from('plan_revisions').insert({
      plan_id: planId,
      revision_number: nextNumber,
      is_selected: true,
      assumptions: aiResponse.assumptions || assumptions || {},
      roadmap: aiResponse.roadmap || {},
      consistency_security: aiResponse.consistency_security || {},
      cost_performance: aiResponse.cost_performance || {},
      team_mapping: aiResponse.team_mapping || {},
    });
    if (insertError) throw insertError;

    // Return complete revisions so the history panel has ids and timestamps.
    const { data: revisions, error: revError } = await supabase
      .from('plan_revisions')
      .select('*')
      .eq('plan_id', planId)
      .order('revision_number', { ascending: false });
    if (revError) throw revError;

    res.status(200).json({
      success: true,
      data: { ...plan, revisions, latest_revision: revisions[0] },
    });
  } catch (err) {
    console.error('recalculatePlan error:', err.message);
    fail(res, err.statusCode || 500, `Failed to recalculate plan assumptions: ${err.message}`);
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlanDetails,
  recalculatePlan,
};
