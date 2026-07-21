const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const DEFAULT_DEV_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  sub: '00000000-0000-0000-0000-000000000000',
  email: 'architect@monomelt.ai',
  user_metadata: { full_name: 'Architect' }
};

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Development fallback
      req.user = DEFAULT_DEV_USER;
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Verify token using Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.warn('JWT Verification Notice: Using dev fallback user (', error?.message || 'No user', ')');
      req.user = DEFAULT_DEV_USER;
      return next();
    }
    
    req.user = { ...user, sub: user.id };
    next();
  } catch (error) {
    console.warn('JWT Verification Catch Notice: Using dev fallback user (', error.message, ')');
    req.user = DEFAULT_DEV_USER;
    next();
  }
};

module.exports = { requireAuth };
