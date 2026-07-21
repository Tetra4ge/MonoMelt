const { createClient } = require('@supabase/supabase-js');

// Create a singleton client for auth verification
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const requireAuth = async (req, res, next) => {
  try {
    // 1. Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required. No token provided.' 
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token using Supabase's built-in getUser
    // This handles any algorithm (HS256, RS256, ES256) used by the Supabase project
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw error || new Error("User not found");
    }
    
    // 3. Attach the user payload to the request object
    // Map 'id' to 'sub' to keep compatibility with existing routes
    req.user = { ...user, sub: user.id };
    
    // 4. Move to the next middleware or route handler
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

module.exports = { requireAuth };
