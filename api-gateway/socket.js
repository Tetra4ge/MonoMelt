const { Server } = require('socket.io');
const Redis = require('ioredis');

const redisSubscriber = new Redis(process.env.REDIS_URL);

const initializeSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'https://openai.onrender.com'] }
  });

  // Handle Frontend Connections
  io.on('connection', (socket) => {
    // Client joins a room specific to their project ID
    socket.on('join_project', (projectId) => {
      socket.join(projectId);
      console.log(`Client joined project room: ${projectId}`);
    });
  });

  // Listen for Python AI Service broadcasts
  redisSubscriber.subscribe('report-updates');
  redisSubscriber.on('message', (channel, message) => {
    if (channel === 'report-updates') {
      try {
        const data = JSON.parse(message);
        // Broadcast exclusively to clients viewing this project
        io.to(data.project_id).emit('report_completed', data);
        console.log(`[Sockets] Broadcasted report_completed to room ${data.project_id}`);
      } catch (err) {
        console.error('[Sockets] Failed to parse report-updates message:', err.message);
      }
    }
  });
};

module.exports = {
  initializeSockets
};
