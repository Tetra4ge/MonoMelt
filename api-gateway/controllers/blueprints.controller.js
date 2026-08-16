const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

/**
 * POST /api/projects/:projectId/blueprints
 * Generates a versioned blueprint export package
 */
const createBlueprint = async (req, res) => {
  try {
    const { projectId } = req.params;
    let { scenarioRevisionId, planRevisionId, planId } = req.body;

    if (planId && (!scenarioRevisionId || !planRevisionId)) {
      const { data: plan, error: planErr } = await getSupabaseClient(req)
        .from('migration_plans')
        .select('scenario_revision_id')
        .eq('id', planId)
        .eq('project_id', projectId)
        .single();
      if (planErr || !plan?.scenario_revision_id) {
        return res.status(404).json({ success: false, message: 'Migration plan or its scenario revision was not found.' });
      }
      const { data: revisions, error: revisionErr } = await getSupabaseClient(req)
        .from('plan_revisions')
        .select('id')
        .eq('plan_id', planId)
        .order('revision_number', { ascending: false })
        .limit(1);
      if (revisionErr || !revisions?.[0]) {
        return res.status(404).json({ success: false, message: 'No plan revision was found for this migration plan.' });
      }
      scenarioRevisionId = plan.scenario_revision_id;
      planRevisionId = revisions[0].id;
    }

    if (!scenarioRevisionId || !planRevisionId) {
      return res.status(400).json({
        success: false,
        message: 'planId or both scenarioRevisionId and planRevisionId are required.'
      });
    }

    const supabase = getSupabaseClient(req);

    // 1. Fetch scenario revision
    const { data: scenario, error: scenarioErr } = await supabase
      .from('scenario_revisions')
      .select('*')
      .eq('id', scenarioRevisionId)
      .single();

    if (scenarioErr || !scenario) {
      return res.status(404).json({ success: false, message: 'Scenario revision not found.' });
    }

    // 2. Fetch plan revision
    const { data: planRev, error: planErr } = await supabase
      .from('plan_revisions')
      .select('*')
      .eq('id', planRevisionId)
      .single();

    if (planErr || !planRev) {
      return res.status(404).json({ success: false, message: 'Plan revision not found.' });
    }

    const { data: proposedServices, error: servicesErr } = await supabase
      .from('proposed_services')
      .select('*')
      .eq('revision_id', scenarioRevisionId);
    if (servicesErr) throw servicesErr;

    // 3. Count existing blueprints for version numbering
    const { data: existingBlueprints } = await supabase
      .from('blueprints')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    const nextVersion = existingBlueprints && existingBlueprints.length > 0
      ? existingBlueprints[0].version_number + 1
      : 1;

    // 4. Call AI Analysis Service to generate blueprint package
    const aiPayload = {
      project_id: projectId,
      scenario_revision_id: scenarioRevisionId,
      plan_revision_id: planRevisionId,
      version_number: nextVersion,
      proposed_services: proposedServices || [],
      roadmap_stages: planRev.roadmap?.stages || [],
      consistency_security_items: planRev.consistency_security?.items || [],
      cost_performance: planRev.cost_performance || null,
      team_assignments: planRev.team_mapping?.team_assignments || [],
      assumptions: planRev.assumptions || {}
    };

    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/blueprints/generate`, aiPayload);

    if (!aiRes.data?.success) {
      throw new Error('AI Service failed to generate blueprint archive');
    }

    const { manifest, blueprint_zip_base64 } = aiRes.data;

    // 5. Persist record in Supabase
    const { data: insertedBlueprint, error: insertErr } = await supabase
      .from('blueprints')
      .insert({
        project_id: projectId,
        scenario_revision_id: scenarioRevisionId,
        plan_revision_id: planRevisionId,
        version_number: nextVersion,
        status: 'completed',
        manifest: manifest,
        artifact_path: `blueprints/${projectId}/blueprint_v${nextVersion}.zip`,
        created_by: req.user.id
      })
      .select('*')
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return res.status(200).json({
      success: true,
      message: 'Blueprint package generated successfully',
      data: {
        ...insertedBlueprint,
        blueprint_zip_base64
      }
    });

  } catch (error) {
    console.error('Create Blueprint Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate blueprint'
    });
  }
};

/**
 * GET /api/projects/:projectId/blueprints
 * Lists all versioned blueprints for a project
 */
const getBlueprints = async (req, res) => {
  try {
    const { projectId } = req.params;
    const supabase = getSupabaseClient(req);

    const { data: blueprints, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: blueprints || []
    });
  } catch (error) {
    console.error('Get Blueprints Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch blueprints'
    });
  }
};

/**
 * GET /api/projects/:projectId/blueprints/:blueprintId
 * Retrieves details and manifest for a specific blueprint
 */
const getBlueprintById = async (req, res) => {
  try {
    const { projectId, blueprintId } = req.params;
    const supabase = getSupabaseClient(req);

    const { data: blueprint, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('id', blueprintId)
      .eq('project_id', projectId)
      .single();

    if (error || !blueprint) {
      return res.status(404).json({ success: false, message: 'Blueprint not found' });
    }

    return res.status(200).json({
      success: true,
      data: blueprint
    });
  } catch (error) {
    console.error('Get Blueprint By ID Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch blueprint details'
    });
  }
};

/**
 * GET /api/projects/:projectId/blueprints/:blueprintId/download
 * Downloads the ZIP archive or generates base64 export stream
 */
const downloadBlueprint = async (req, res) => {
  try {
    const { projectId, blueprintId } = req.params;
    const supabase = getSupabaseClient(req);

    const { data: blueprint, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('id', blueprintId)
      .eq('project_id', projectId)
      .single();

    if (error || !blueprint) {
      return res.status(404).json({ success: false, message: 'Blueprint not found' });
    }

    // Fetch scenario & plan to regenerate zip stream if not stored as raw file
    const [scenarioRes, planRes, servicesRes] = await Promise.all([
      supabase.from('scenario_revisions').select('*').eq('id', blueprint.scenario_revision_id).single(),
      supabase.from('plan_revisions').select('*').eq('id', blueprint.plan_revision_id).single(),
      supabase.from('proposed_services').select('*').eq('revision_id', blueprint.scenario_revision_id)
    ]);

    const aiPayload = {
      project_id: projectId,
      scenario_revision_id: blueprint.scenario_revision_id,
      plan_revision_id: blueprint.plan_revision_id,
      version_number: blueprint.version_number,
      proposed_services: servicesRes.data || [],
      roadmap_stages: planRes.data?.roadmap?.stages || [],
      consistency_security_items: planRes.data?.consistency_security?.items || [],
      cost_performance: planRes.data?.cost_performance || null,
      team_assignments: planRes.data?.team_mapping?.team_assignments || []
    };

    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/blueprints/generate`, aiPayload);
    const { blueprint_zip_base64 } = aiRes.data;

    const zipBuffer = Buffer.from(blueprint_zip_base64, 'base64');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="blueprint_v${blueprint.version_number}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);

    return res.send(zipBuffer);

  } catch (error) {
    console.error('Download Blueprint Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to download blueprint package'
    });
  }
};

module.exports = {
  createBlueprint,
  getBlueprints,
  getBlueprintById,
  downloadBlueprint
};
