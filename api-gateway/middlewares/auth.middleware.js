const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const requireAuth = async (req, res, next) => {
  try {
    // Already authenticated earlier in the chain (e.g. by the project guard).
    if (req.user) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing bearer token' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token using Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired bearer token' });
    }
    
    req.user = { ...user, sub: user.id };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireAuth };
