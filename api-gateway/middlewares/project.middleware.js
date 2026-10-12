const { createClient } = require('@supabase/supabase-js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Service-role client: ownership is checked explicitly below, never assumed from RLS.
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Guards every /api/projects/:projectId/* route: the authenticated user must own
 * the project. Controllers that use a service-role client (plans, blueprints,
 * reports) rely on this because they filter by the URL's project id alone.
 */
const requireProjectOwner = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!UUID_RE.test(projectId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { data, error } = await admin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', req.user.sub)
      .maybeSingle();

    if (error) return next(error);
    if (!data) return res.status(404).json({ success: false, message: 'Project not found' });
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireProjectOwner, UUID_RE };
