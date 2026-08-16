const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger.config');
const { errorHandler } = require('./middlewares/error.middleware');

// Load environment variables
dotenv.config();

// Validate Required Environment Variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_JWT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Request IDs
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Middleware
const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173', 'https://openai.onrender.com'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Morgan logging (redact authorization header)
morgan.token('req-id', (req) => req.id);
app.use(morgan((tokens, req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    req.headers.authorization = 'Bearer [REDACTED]';
  }
  return [
    tokens['req-id'](req, res),
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}));

// Swagger API Documentation Route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- Routes ---
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/projects', require('./routes/projects.routes'));
app.use('/api/projects/:projectId/analysis', require('./routes/analysis.routes'));
app.use('/api/projects/:projectId/intelligence', require('./routes/intelligence.routes'));
app.use('/api/projects/:projectId/scenarios', require('./routes/decomposition.routes'));
app.use('/api/projects/:projectId/plans', require('./routes/planning.routes'));
app.use('/api/projects/:projectId/blueprints', require('./routes/blueprints.routes'));
app.use('/api/projects/:projectId/deployments', require('./routes/deployments.routes'));
app.use('/api/projects/:projectId', require('./routes/planning.routes'));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: API Gateway Health Check
 *     description: Returns the operational status of the gateway.
 *     responses:
 *       200:
 *         description: Gateway is up and running.
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'api-gateway',
    status: 'up',
    timestamp: new Date().toISOString()
  });
});


// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway is running on http://localhost:${PORT}`);
});
