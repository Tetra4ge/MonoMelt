const { createClient } = require('@supabase/supabase-js');

const getClient = (req) => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: req.headers.authorization } },
});

const stages = [
  ['building', '[BUILD] Validating generated service templates...'],
  ['provisioning', '[PLAN] Preparing deployment manifests...'],
  ['deploying', '[DEPLOY] Applying generated service definitions...'],
  ['deployed', '[HEALTH] Blueprint deployment simulation completed.'],
];

function advance(deployment) {
  const seconds = Math.floor((Date.now() - new Date(deployment.created_at).getTime()) / 2000);
  const index = Math.min(seconds, stages.length - 1);
  const logs = stages.slice(0, index + 1).map(([, message]) => message);
  return { status: stages[index][0], logs };
}

async function loadDeployment(req, res) {
  const { projectId, deploymentId } = req.params;
  const client = getClient(req);
  const { data, error } = await client.from('deployments').select('*').eq('id', deploymentId).eq('project_id', projectId).single();
  if (error || !data) { res.status(404).json({ success: false, message: 'Deployment not found' }); return null; }
  const current = advance(data);
  if (current.status !== data.status) await client.from('deployments').update({ ...current, updated_at: new Date().toISOString() }).eq('id', data.id);
  return { ...data, ...current };
}

exports.startDeployment = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { blueprintId } = req.body;
    if (!blueprintId) return res.status(400).json({ success: false, message: 'blueprintId is required' });
    const client = getClient(req);
    const { data: blueprint, error: blueprintError } = await client.from('blueprints').select('id,status').eq('id', blueprintId).eq('project_id', projectId).single();
    if (blueprintError || !blueprint || blueprint.status !== 'completed') return res.status(409).json({ success: false, message: 'A completed blueprint is required before deployment.' });
    const initial = { status: stages[0][0], logs: [stages[0][1]] };
    const { data, error } = await client.from('deployments').insert({ project_id: projectId, blueprint_id: blueprintId, owner_id: req.user.sub, ...initial }).select().single();
    if (error) throw error;
    res.status(202).json({ success: true, data });
  } catch (error) { next(error); }
};

exports.getDeployment = async (req, res, next) => {
  try { const deployment = await loadDeployment(req, res); if (deployment) res.json({ success: true, data: deployment }); } catch (error) { next(error); }
};

exports.getServiceHealth = async (req, res, next) => {
  try {
    const deployment = await loadDeployment(req, res);
    if (!deployment) return;
    if (deployment.status !== 'deployed') return res.status(409).json({ success: false, message: 'Deployment has not completed.' });
    res.json({ success: true, data: [{ service_name: 'generated-api-gateway', uptime: 'simulation complete', cpu_usage: 'n/a', memory: 'n/a', endpoint_url: 'local blueprint artifact' }] });
  } catch (error) { next(error); }
};
