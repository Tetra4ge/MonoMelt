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

const getScenarioDetails = async (req, res) => {
  const { scenarioId } = req.params;
  const supabase = getSupabaseClient(req);

  // We need to fetch the scenario, its latest revision, and the proposed services for that revision.
  const { data: scenario, error: scenarioError } = await supabase
    .from('decomposition_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .single();

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

  const ownerId = req.user?.sub || 'dc035a11-d7ca-47b5-a2ab-865714d71cd4';
  const scenarioId = require('crypto').randomUUID();

  let scenario = {
    id: scenarioId,
    project_id: projectId,
    source_version_id,
    owner_id: ownerId,
    strategy_type,
    status: 'generating'
  };

  try {
    const { data, error } = await supabase
      .from('decomposition_scenarios')
      .insert([scenario])
      .select()
      .single();

    if (!error && data) {
      scenario = data;
    }
  } catch (e) {
    console.warn("decomposition_scenarios insert warning:", e.message);
  }

  // Trigger Python AI Service asynchronously
  try {
    const aiResponse = await proxyToAiService(
      'POST', 
      `/decomposition/generate`, 
      {
        scenario_id: scenario.id,
        project_id: projectId,
        source_version_id,
        strategy_type,
        owner_id: ownerId
      }
    );
    
    res.status(202).json({ success: true, data: scenario, ai_status: 'triggered' });
  } catch (err) {
    console.warn("AI Service trigger notice:", err.message);
    res.status(202).json({ success: true, data: scenario, ai_status: 'fallback' });
  }
};

const createRevision = async (req, res) => {
    // For handling manual user edits to a scenario's boundaries
    const { scenarioId } = req.params;
    const { services } = req.body; // Array of { name, assigned_nodes }
    const supabase = getSupabaseClient(req);
  
    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ error: 'services array is required' });
    }
  
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
