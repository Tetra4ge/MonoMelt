const { createClient } = require('@supabase/supabase-js');
const { proxyToAiService } = require('../services/ai.service');

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const getScenarios = async (req, res) => {
  const { projectId } = req.params;
  const supabase = getSupabaseClient(req);

  const { data, error } = await supabase
    .from('decomposition_scenarios')
    .select(`
      *,
      scenario_revisions (
        id,
        revision_number,
        is_selected,
        metrics,
        validations,
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

const STRATEGIES = ['conservative', 'aggressive', 'domain'];

const getScenarioDetails = async (req, res) => {
  const { projectId, scenarioId } = req.params;
  const supabase = getSupabaseClient(req);

  // We need to fetch the scenario, its latest revision, and the proposed services for that revision.
  const { data: scenario, error: scenarioError } = await supabase
    .from('decomposition_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (scenarioError) return res.status(500).json({ error: scenarioError.message });
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  // Get all revisions
  const { data: revisions, error: revError } = await supabase
    .from('scenario_revisions')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('revision_number', { ascending: false });

  if (revError) return res.status(500).json({ error: revError.message });
  if (!revisions || revisions.length === 0) {
      return res.json({ success: true, data: { ...scenario, revisions: [] } });
  }

  const latestRevisionId = revisions[0].id;

  // Get proposed services for the latest revision
  const { data: services, error: srvError } = await supabase
    .from('proposed_services')
    .select('*')
    .eq('revision_id', latestRevisionId);

  if (srvError) return res.status(500).json({ error: srvError.message });

  res.json({ 
    success: true, 
    data: { 
        ...scenario, 
        revisions, 
        proposed_services: services 
    } 
  });
};

const triggerGeneration = async (req, res) => {
  const { projectId } = req.params;
  const source_version_id = req.body.source_version_id || req.body.sourceVersionId;
  const strategy_type = req.body.strategy_type || req.body.strategyType;
  const supabase = getSupabaseClient(req);

  if (!source_version_id || !strategy_type) {
    return res.status(400).json({ error: 'source_version_id and strategy_type are required' });
  }
  if (!STRATEGIES.includes(strategy_type)) {
    return res.status(400).json({ error: `strategy_type must be one of: ${STRATEGIES.join(', ')}` });
  }

  // The source version must belong to this project, otherwise a caller could
  // cluster another tenant's graph by passing its id.
  const { data: sourceVersion } = await supabase
    .from('source_versions')
    .select('id')
    .eq('id', source_version_id)
    .eq('project_id', projectId)
    .maybeSingle();
  if (!sourceVersion) return res.status(404).json({ error: 'Source version not found for this project' });

  const ownerId = req.user.sub;

  const { data: scenario, error: insertError } = await supabase
    .from('decomposition_scenarios')
    .insert([{ project_id: projectId, source_version_id, owner_id: ownerId, strategy_type, status: 'generating' }])
    .select()
    .single();

  if (insertError || !scenario) {
    console.error('decomposition_scenarios insert failed:', insertError?.message);
    return res.status(500).json({ error: 'Failed to create the decomposition scenario' });
  }

  try {
    await proxyToAiService('POST', '/decomposition/generate', {
      scenario_id: scenario.id,
      project_id: projectId,
      source_version_id,
      strategy_type,
      owner_id: ownerId,
    });
    res.status(202).json({ success: true, data: scenario, ai_status: 'triggered' });
  } catch (err) {
    // Don't leave the scenario stuck in 'generating' (the UI would poll forever).
    console.error('AI service decomposition trigger failed:', err.message);
    await supabase.from('decomposition_scenarios').update({ status: 'failed' }).eq('id', scenario.id);
    res.status(err.statusCode && err.statusCode < 500 ? err.statusCode : 502).json({
      error: `Decomposition could not be started: ${err.message}`,
    });
  }
};

const createRevision = async (req, res) => {
    // For handling manual user edits to a scenario's boundaries
    const { projectId, scenarioId } = req.params;
    const { services } = req.body; // Array of { name, assigned_nodes }
    const supabase = getSupabaseClient(req);
  
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'services array is required' });
    }

    const { data: scenario } = await supabase
      .from('decomposition_scenarios')
      .select('id')
      .eq('id', scenarioId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  
    // 1. Get current max revision number
    const { data: latestRev, error: maxError } = await supabase
      .from('scenario_revisions')
      .select('revision_number')
      .eq('scenario_id', scenarioId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .single();
  
    if (maxError && maxError.code !== 'PGRST116') { // PGRST116 is no rows returned
        return res.status(500).json({ error: maxError.message });
    }
  
    const nextRevisionNumber = (latestRev?.revision_number || 0) + 1;
  
    // 2. Create new revision
    const { data: newRevision, error: revError } = await supabase
      .from('scenario_revisions')
      .insert([
        {
          scenario_id: scenarioId,
          revision_number: nextRevisionNumber
        }
      ])
      .select()
      .single();
  
    if (revError) return res.status(500).json({ error: revError.message });
  
    // 3. Create proposed services for this revision
    const servicesToInsert = services.map(s => ({
        revision_id: newRevision.id,
        name: s.name,
        assigned_nodes: s.assigned_nodes || []
    }));

    const { error: srvError } = await supabase
      .from('proposed_services')
      .insert(servicesToInsert);

    if (srvError) return res.status(500).json({ error: srvError.message });

    res.status(201).json({ success: true, data: newRevision });
};

module.exports = {
  getScenarios,
  getScenarioDetails,
  triggerGeneration,
  createRevision
};
