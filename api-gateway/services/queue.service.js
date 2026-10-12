const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL,
};

// Queue for ingestion tasks
const ingestionQueue = new Queue('ingestion', { connection });

// Queue for report generation tasks
const reportQueue = new Queue('report-generation', { connection });

// Without listeners a Redis outage surfaces as an unhandled 'error' event.
for (const queue of [ingestionQueue, reportQueue]) {
  queue.on('error', (err) => console.error(`[Queue:${queue.name}] ${err.message}`));
}

// BullMQ buffers commands while Redis is unreachable, so a plain `await queue.add()`
// can hang a request forever. Fail fast with a 503 instead.
const QUEUE_TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_MS || 5000);
const withTimeout = (promise) => {
  promise.catch(() => {}); // the losing side of the race must never become an unhandled rejection
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('The job queue is unavailable. Please try again shortly.');
      err.statusCode = 503;
      err.expose = true;
      reject(err);
    }, QUEUE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Enqueue a new ingestion job
 * @param {Object} data Job payload
 * @returns {Promise<import('bullmq').Job>}
 */
const enqueueIngestionJob = async (data) => {
  // Adding the job to the queue
  const job = await withTimeout(ingestionQueue.add('process-source', data, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }));
  
  return job;
};

/**
 * Enqueue a new report generation job
 * @param {Object} data Job payload containing projectId and ownerId
 * @returns {Promise<import('bullmq').Job>}
 */
const enqueueReportJob = async (data) => {
  return await withTimeout(reportQueue.add('generate-report', data, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }));
};

module.exports = {
  ingestionQueue,
  enqueueIngestionJob,
  reportQueue,
  enqueueReportJob
};
