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

### 2.2 Polling vs WebSockets
To deliver the finalized report to the frontend, we must choose between WebSockets and HTTP Polling. Given the strict time constraints of a hackathon and the fact that report generation takes ~15 seconds, setting up a robust WebSocket connection is architectural overkill. Instead, Phase 4 will implement a simple, stateless HTTP `GET` route in the API Gateway. The React app (Phase 5) will be instructed to poll this route every 3 seconds until the status reads `completed`.

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

## 4. API Gateway Routes (`api-gateway`)

Once the Python backend generates the report and saves it to Supabase (Phase 1/3), the API Gateway must expose it to the React frontend.

### 4.1 Route Definition (`routes/reports.routes.js`)

```javascript
import express from 'express';
import { getLatestReport, getReportHistory } from '../controllers/reports.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Both routes require standard JWT authentication
router.use(requireAuth);

// Fetch the most recent report (used for polling and main dashboard)
router.get('/:projectId', getLatestReport);

// Fetch all historical versions (used for the dropdown UI)
router.get('/:projectId/history', getReportHistory);

export default router;
```

### 4.2 Controller Logic (`controllers/reports.controller.js`)

```javascript
import { supabase } from '../config/supabase.js';

export const getLatestReport = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id; // From requireAuth middleware

        // Query the schema defined in Phase 1
        const { data, error } = await supabase
            .from('project_reports')
            .select('*')
            .eq('project_id', projectId)
            .eq('owner_id', userId) // Security enforcement
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // Supabase returns PGRST116 if no rows are found
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'No report found.' });
            }
            throw error;
        }

        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (err) {
        console.error('[API Gateway] getLatestReport Error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getReportHistory = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.id;

        // Fetch just the metadata for the history dropdown, omitting the heavy payload
        const { data, error } = await supabase
            .from('project_reports')
            .select('id, version_number, status, created_at, notion_url')
            .eq('project_id', projectId)
            .eq('owner_id', userId)
            .order('version_number', { ascending: false });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            data: data
        });

    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
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

In **Phase 5**, we shift entirely to the Frontend. We will construct `ReportPage.tsx`, utilizing React Query to poll the newly created `GET /api/reports/:projectId` route, and we will build the dynamic Tailwind/Recharts user interface to render the complex nested JSON payload visually.
