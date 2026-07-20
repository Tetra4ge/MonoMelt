const express = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

const { createClient } = require('@supabase/supabase-js');

// Create a helper to generate a Supabase client that acts as the user
const getSupabaseClient = (req) => {
  // We use the user's access token as the API key to satisfy the client, 
  // and pass the Authorization header so PostgREST enforces RLS correctly.
  const token = req.headers.authorization.split(' ')[1];
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: req.headers.authorization
      }
    }
  });
};

// Get all projects for user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data, error } = await supabase.from('projects').select('*').eq('owner_id', req.user.sub);
    
    if (error) throw error;
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Get project by ID
router.get('/:projectId', requireAuth, async (req, res, next) => {
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
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized' });
    }
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Create project
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const supabase = getSupabaseClient(req);
    const newProject = {
      ...req.body,
      owner_id: req.user.sub
    };
    
    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();
      
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// Mount sub-routers for sources and jobs
const sourcesRouter = require('./sources.routes');
const jobsRouter = require('./jobs.routes');

// Use mergeParams in the sub-routers so they can access :projectId
router.use('/:projectId/sources', sourcesRouter);
router.use('/:projectId/jobs', jobsRouter);
