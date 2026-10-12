const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createClient } = require('@supabase/supabase-js');
const { UUID_RE } = require('./middlewares/project.middleware');

const redisSubscriber = new Redis(process.env.REDIS_URL);
redisSubscriber.on('error', (err) => console.error('[Sockets] Redis subscriber error:', err.message));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const initializeSockets = (httpServer) => {
  const io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  // Release the Redis connection on shutdown so the process can exit cleanly.
  httpServer.on('close', () => redisSubscriber.disconnect());

  // Only signed-in users may connect. The client sends its Supabase access token.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return next(new Error('unauthorized'));
      socket.data.userId = data.user.id;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Rooms are per project, and a user may only join rooms for projects they own.
    socket.on('join_project', async (projectId, ack) => {
      try {
        if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) throw new Error('invalid project');
        const { data, error } = await supabase
          .from('projects')
          .select('id')
          .eq('id', projectId)
          .eq('owner_id', socket.data.userId)
          .maybeSingle();
        if (error || !data) throw new Error('forbidden');
        socket.join(projectId);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });
  });

  // Listen for AI service broadcasts (ai-service/services/realtime.py)
  redisSubscriber.subscribe('report-updates', (err) => {
    if (err) console.error('[Sockets] Failed to subscribe to report-updates:', err.message);
  });
  redisSubscriber.on('message', (channel, message) => {
    if (channel !== 'report-updates') return;
    try {
      const data = JSON.parse(message);
      // Broadcast exclusively to clients viewing this project
      io.to(data.project_id).emit('report_completed', data);
    } catch (err) {
      console.error('[Sockets] Failed to parse report-updates message:', err.message);
    }
  });

  return io;
};

module.exports = {
  initializeSockets
};
