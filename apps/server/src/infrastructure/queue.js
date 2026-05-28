import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from './redis.js';

console.log("REDIS INIT SOURCE: queue.js");
console.log("Runtime REDIS_URL:", process.env.REDIS_URL);

export const ingestionQueue = new Queue('ingestion-queue', {
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

export const queueEvents = new QueueEvents('ingestion-queue', {
  connection: redisConnection,
});

export default ingestionQueue;
