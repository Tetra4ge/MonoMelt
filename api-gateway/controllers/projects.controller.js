const { createClient } = require('@supabase/supabase-js');

const getSupabaseClient = (req) => {
  const token = req.headers.authorization.split(' ')[1];
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: req.headers.authorization } }
  });
};

const getAllProjects = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase.from('projects').select('*').eq('owner_id', req.user.sub);
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const getProjectById = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).eq('owner_id', req.user.sub).single();
    if (error || !data) { return res.status(404).json({ success: false, message: 'Project not found or unauthorized' }); }
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const createProject = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const newProject = { ...req.body, owner_id: req.user.sub };
    const { data, error } = await supabase.from('projects').insert(newProject).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

module.exports = { getAllProjects, getProjectById, createProject };
