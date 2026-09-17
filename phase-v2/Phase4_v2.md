# MonoMelt v2: Phase 4 (Async Orchestration & API Gateway)

## 1. Phase Overview

Phase 4 shifts focus from the Python AI Service back to the Node.js ecosystem (the API Gateway and the Background Worker). While Phase 3 built the engine to generate the report, Phase 4 builds the ignition system and the delivery mechanism.

This phase has two primary objectives:
1.  **Workflow Orchestration (Worker):** Implement the BullMQ job that automatically triggers the FastAPI `POST /reports/generate` endpoint precisely when Agents 1 through 5 have successfully completed their tasks.
2.  **Data Delivery (API Gateway):** Create the Express.js HTTP routes that the React Frontend will poll to retrieve the finalized JSON report from the Supabase database.

This document serves as the comprehensive, 150+ line technical specification for executing Phase 4.

---

## 2. Architectural Objectives

### 2.1 Decoupled Microservice Communication
The `worker` service (Node.js) must communicate with the `ai-service` (Python/FastAPI) over the internal Docker network. It is crucial that the worker does not wait synchronously for the Python service to finish generation. Because we implemented `BackgroundTasks` in Phase 3, the Python service will return a 202 Accepted instantly. The Node.js worker can then safely mark its BullMQ job as `completed` without blocking the main event loop.

### 2.2 Real-Time Delivery via WebSockets
Because this is a full semester project rather than a hackathon prototype, we will implement a robust, real-time WebSocket connection. The API Gateway will utilize `socket.io` and a Redis Pub/Sub subscriber. When the Python AI Service finishes generation, it will publish an event to Redis. The API Gateway will instantly broadcast this to the specific React client, entirely eliminating the need for HTTP polling.

---

## 3. Worker Orchestration (`worker/index.js`)

The MonoMelt worker utilizes Redis and BullMQ to handle background processing. We must introduce a new job processor to handle the `generate-report` queue.

### 3.1 Defining the Queue
If it does not already exist, ensure the worker is connected to a dedicated queue for AI tasks, or reuse the existing decomposition queue.

```javascript
import { Queue, Worker } from 'bullmq';
import axios from 'axios';

// The URL of the internal Python service (configured in docker-compose)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

// Connect to Redis
const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
};

export const reportQueue = new Queue('report-generation', { connection });
```

### 3.2 Implementing the Worker Logic
The worker must process incoming jobs and fire an HTTP POST request to the Python backend.

```javascript
const reportWorker = new Worker('report-generation', async (job) => {
  const { projectId, ownerId } = job.data;
  
  try {
    console.log(`[Worker] Triggering Report Generation for Project: ${projectId}`);
    
    // Trigger Phase 3 FastAPI Endpoint
    const response = await axios.post(`${AI_SERVICE_URL}/api/reports/generate`, {
      project_id: projectId,
      owner_id: ownerId
    });
    
    // Because Phase 3 returns a 202 instantly via BackgroundTasks,
    // this log will appear almost immediately.
    console.log(`[Worker] FastAPI Acknowledged: ${response.data.message}`);
    
    return { success: true, message: "Report generation handed off to AI service." };
    
  } catch (error) {
    console.error(`[Worker] Failed to trigger report generation:`, error.message);
    // Throwing an error forces BullMQ to retry the job based on backoff settings
    throw new Error('Failed to connect to AI Service');
  }
}, { 
    connection,
    concurrency: 5 // Allow multiple reports to trigger simultaneously
});

reportWorker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed: ${err.message}`);
});
```

### 3.3 The Trigger Hook
The `generate-report` job must be added to the queue *only* when the previous agents are done. Assuming the existing pipeline runs a `post-analysis` hook or a `planning-complete` job:

```javascript
// Inside the final step of the existing Decomposition/Planning worker:
await reportQueue.add('generate-report', {
    projectId: currentProject.id,
    ownerId: currentProject.user_id
}, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
});
```

---

## 4. API Gateway Real-Time Sync (`api-gateway`)

Once the Python backend generates the report and saves it to Supabase (Phase 1/3), the API Gateway must notify the React frontend via WebSockets.

### 4.1 Redis Pub/Sub & Socket.io Setup (`socket.js`)

We will instantiate a Socket.io server and a Redis Subscriber in the API Gateway.

```javascript
import { Server } from 'socket.io';
import Redis from 'ioredis';

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

export const initializeSockets = (httpServer) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.FRONTEND_URL }
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
            const data = JSON.parse(message);
            // Broadcast exclusively to clients viewing this project
            io.to(data.project_id).emit('report_completed', data);
        }
    });
};
```

### 4.2 Initial Fetch Route (`routes/reports.routes.js`)
We still need a standard HTTP route for the frontend's initial page load (before the socket event fires).

```javascript
import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/:projectId', async (req, res) => {
    const { data, error } = await supabase
        .from('project_reports')
        .select('*')
        .eq('project_id', req.params.projectId)
        .eq('owner_id', req.user.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();
        
    if (error && error.code !== 'PGRST116') return res.status(500).json({ success: false });
    return res.status(200).json({ success: true, data: data || null });
});

export default router;
```

---

## 5. Security & Edge Cases

### 5.1 Auth Middleware Verification
The `requireAuth` middleware is strictly applied to the Express router. Unlike the Python backend (which uses the Service Role Key), the Express routes use the standard Supabase client and explicitly append `.eq('owner_id', userId)` to every query. Even if a malicious user guesses another company's `projectId`, the query will return an empty set, preventing cross-tenant data leakage.

### 5.2 Network Resilience
If the Python backend is temporarily down or restarting when BullMQ attempts to trigger the `generate-report` job, the `axios.post` will throw an error. The BullMQ configuration `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 } }` ensures the worker will retry 2 seconds later, and then 4 seconds later, preventing silent failures.

---

## 6. Integration Hand-Off (To Phase 5)

With Phase 4 complete, the backend is now 100% finished. 
1. BullMQ triggers the generation automatically.
2. FastAPI processes the data and saves it to Postgres.
3. Express serves the finalized JSON securely to authenticated users.

In **Phase 5**, we shift entirely to the Frontend. We will construct `ReportPage.tsx`, utilizing `socket.io-client` to listen for the real-time `report_completed` event emitted by the Gateway, and we will build the dynamic Tailwind/Recharts user interface to render the complex nested JSON payload visually.
