const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL,
};

// Queue for ingestion tasks
const ingestionQueue = new Queue('ingestion', { connection });

// Queue for report generation tasks
const reportQueue = new Queue('report-generation', { connection });

/**
 * Enqueue a new ingestion job
 * @param {Object} data Job payload
 * @returns {Promise<import('bullmq').Job>}
 */
const enqueueIngestionJob = async (data) => {
  // Adding the job to the queue
  const job = await ingestionQueue.add('process-source', data, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  });
  
  return job;
};

/**
 * Enqueue a new report generation job
 * @param {Object} data Job payload containing projectId and ownerId
 * @returns {Promise<import('bullmq').Job>}
 */
const enqueueReportJob = async (data) => {
  return await reportQueue.add('generate-report', data, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
};

module.exports = {
  ingestionQueue,
  enqueueIngestionJob,
  reportQueue,
  enqueueReportJob
};
