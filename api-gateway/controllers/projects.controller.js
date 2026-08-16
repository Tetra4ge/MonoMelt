const { createClient } = require('@supabase/supabase-js');

const getSupabaseClient = (req) => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {} }
  });
};

const getAllProjects = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', req.user.sub)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data: data || [] });
  } catch (error) { 
    next(error); 
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const supabase = getSupabaseClient(req);
    
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('owner_id', req.user.sub)
      .single();

    if (error || !data) { 
      return res.status(404).json({ success: false, message: 'Project not found' }); 
    }
    res.status(200).json({ success: true, data });
  } catch (error) { 
    next(error); 
  }
};

const createProject = async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const ownerId = req.user?.id || req.user?.sub;

    const newProject = { 
      name: req.body.name || `Monolith_${Math.floor(Math.random() * 9000 + 1000)}`,
      description: req.body.description || 'Microservice transformation workspace',
      source_type: req.body.source_type || 'github',
      owner_id: ownerId
    };

    const { data, error } = await supabase.from('projects').insert(newProject).select().single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) { 
    next(error); 
  }
};

module.exports = { getAllProjects, getProjectById, createProject };
