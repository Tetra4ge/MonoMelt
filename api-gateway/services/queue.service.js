const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL,
};

// Queue for ingestion tasks
const ingestionQueue = new Queue('ingestion', { connection });

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

module.exports = {
  ingestionQueue,
  enqueueIngestionJob
};
