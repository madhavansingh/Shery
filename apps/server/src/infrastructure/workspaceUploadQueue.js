import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './redis.js';

console.log("REDIS INIT SOURCE: workspaceUploadQueue.js");
console.log("Runtime REDIS_URL:", process.env.REDIS_URL);

export const workspaceUploadQueue = new Queue('workspace-upload-queue', {
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

export const workspaceUploadQueueEvents = new QueueEvents('workspace-upload-queue', {
  connection: redisConnection,
});

export default workspaceUploadQueue;
