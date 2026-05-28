import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './redis.js';

console.log("REDIS INIT SOURCE: workspaceQueue.js");
console.log("Runtime REDIS_URL:", process.env.REDIS_URL);

export const workspaceIngestionQueue = new Queue('workspace-ingestion-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export const workspaceQueueEvents = new QueueEvents('workspace-ingestion-queue', {
  connection: redisConnection,
});

export default workspaceIngestionQueue;
