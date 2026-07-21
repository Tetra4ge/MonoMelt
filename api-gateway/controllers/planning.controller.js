const { createClient } = require('@supabase/supabase-js');
const { proxyToAiService } = require('../services/ai.service');

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const createPlan = async (req, res) => {
  const { projectId, scenarioId } = req.params;
  const { title, assumptions } = req.body;
  const supabase = getSupabaseClient(req);

  try {
    // 1. Get latest scenario revision and proposed services
    const { data: revisions, error: revError } = await supabase
      .from('scenario_revisions')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('revision_number', { ascending: false })
      .limit(1);

    if (revError) return res.status(500).json({ error: revError.message });
    const latestScenarioRev = revisions && revisions.length > 0 ? revisions[0] : null;

    let proposedServices = [];
    if (latestScenarioRev) {
      const { data: services } = await supabase
        .from('proposed_services')
        .select('*')
        .eq('revision_id', latestScenarioRev.id);
      proposedServices = services || [];
    }

    // 2. Call AI Service to compute plan
    const aiResponse = await proxyToAiService('POST', '/api/planning/generate', {
      scenario_revision_id: latestScenarioRev ? latestScenarioRev.id : scenarioId,
      proposed_services: proposedServices,
      assumptions: assumptions || {}
    });

    const planData = aiResponse;

    // 3. Store in Postgres migration_plans
    const { data: planRecord, error: planError } = await supabase
      .from('migration_plans')
      .insert([
        {
          project_id: projectId,
          scenario_revision_id: latestScenarioRev ? latestScenarioRev.id : scenarioId,
          owner_id: req.user?.sub || '00000000-0000-0000-0000-000000000000',
          title: title || 'Microservice Migration Plan',
          status: 'completed'
        }
      ])
      .select()
      .single();

    if (planError) return res.status(500).json({ error: planError.message });

    // 4. Store in Postgres plan_revisions
    const { data: revisionRecord, error: revInsertError } = await supabase
      .from('plan_revisions')
      .insert([
        {
          plan_id: planRecord.id,
          revision_number: 1,
          is_selected: true,
          assumptions: planData.assumptions || {},
          roadmap: planData.roadmap || {},
          consistency_security: planData.consistency_security || {},
          cost_performance: planData.cost_performance || {},
          team_mapping: planData.team_mapping || {}
        }
      ])
      .select()
      .single();

    if (revInsertError) return res.status(500).json({ error: revInsertError.message });

    res.status(201).json({
      success: true,
      data: {
        ...planRecord,
        revisions: [revisionRecord],
        latest_revision: revisionRecord
      }
    });

  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: 'Failed to create migration plan',
      details: err.message
    });
  }
};

const getPlans = async (req, res) => {
  const { projectId } = req.params;
  const supabase = getSupabaseClient(req);

  const { data, error } = await supabase
    .from('migration_plans')
    .select(`
      *,
      plan_revisions (
        id,
        revision_number,
        is_selected,
        assumptions,
        roadmap,
        consistency_security,
        cost_performance,
        team_mapping,
        created_at
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, data });
};

const getPlanDetails = async (req, res) => {
  const { planId } = req.params;
  const supabase = getSupabaseClient(req);

  const { data: plan, error: planError } = await supabase
    .from('migration_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError) return res.status(500).json({ error: planError.message });
  if (!plan) return res.status(404).json({ error: 'Migration plan not found' });

  const { data: revisions, error: revError } = await supabase
    .from('plan_revisions')
    .select('*')
    .eq('plan_id', planId)
    .order('revision_number', { ascending: false });

  if (revError) return res.status(500).json({ error: revError.message });

  res.json({
    success: true,
    data: {
      ...plan,
      revisions: revisions || [],
      latest_revision: revisions && revisions.length > 0 ? revisions[0] : null
    }
  });
};

const recalculatePlan = async (req, res) => {
  const { planId } = req.params;
  const { assumptions } = req.body;
  const supabase = getSupabaseClient(req);

  try {
    // 1. Fetch current plan and latest revision
    const { data: plan, error: planError } = await supabase
      .from('migration_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) return res.status(404).json({ error: 'Migration plan not found' });

    const { data: revisions } = await supabase
      .from('plan_revisions')
      .select('revision_number')
      .eq('plan_id', planId)
      .order('revision_number', { ascending: false })
      .limit(1);

    const latestRevNum = revisions && revisions.length > 0 ? revisions[0].revision_number : 0;

    // 2. Call AI Service to recalculate
    const aiResponse = await proxyToAiService('POST', '/api/planning/recalculate', {
      scenario_revision_id: plan.scenario_revision_id,
      assumptions: assumptions || {}
    });

    // 3. Insert new immutable plan revision
    const { data: newRevision, error: insertError } = await supabase
      .from('plan_revisions')
      .insert([
        {
          plan_id: planId,
          revision_number: latestRevNum + 1,
          is_selected: true,
          assumptions: aiResponse.assumptions || assumptions || {},
          roadmap: aiResponse.roadmap || {},
          consistency_security: aiResponse.consistency_security || {},
          cost_performance: aiResponse.cost_performance || {},
          team_mapping: aiResponse.team_mapping || {}
        }
      ])
      .select()
      .single();

    if (insertError) return res.status(500).json({ error: insertError.message });

    res.status(200).json({
      success: true,
      data: newRevision
    });

  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: 'Failed to recalculate plan assumptions',
      details: err.message
    });
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlanDetails,
  recalculatePlan
};
