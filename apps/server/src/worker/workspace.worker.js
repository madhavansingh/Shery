import { Worker } from 'bullmq';
import { redisConnection } from '../infrastructure/redis.js';
import workspaceContainer from '../container/workspaceContainer.js';
import logger from '../loggers/logger.js';

console.log("REDIS INIT SOURCE: workspace.worker.js");
console.log("Runtime REDIS_URL:", process.env.REDIS_URL);

export const workspaceWorker = new Worker(
  'workspace-ingestion-queue',
  async (job) => {
    const { workspaceId, sourceId, type, youtubeUrl, fileBuffer, fileName, text, title } = job.data;
    
    logger.info(`Starting background workspace ingestion job ${job.id} for Source: ${sourceId} in Workspace: ${workspaceId} (Type: ${type}, Attempt: ${job.attemptsMade + 1})`);

    const ingestionService = workspaceContainer.ingestionService;

    if (type === 'youtube') {
      await workspaceContainer.workspaceYoutubePipeline.run(workspaceId, sourceId, youtubeUrl);
    } else if (type === 'pdf') {
      // Reconstruct buffer from JSON object if sent over BullMQ serialization
      let buffer = fileBuffer;
      if (fileBuffer && fileBuffer.type === 'Buffer') {
        buffer = Buffer.from(fileBuffer.data);
      } else if (!(fileBuffer instanceof Buffer) && fileBuffer) {
        buffer = Buffer.from(fileBuffer);
      }

      // If buffer is missing (e.g., during manual pipeline retries), reload from storage provider
      if (!buffer) {
        try {
          buffer = await workspaceContainer.workspaceStorageService.getFileBuffer(workspaceId, sourceId, 'original.pdf');
          logger.info(`Loaded original.pdf from storage provider for retry`, { sourceId });
        } catch (readErr) {
          logger.warn('Failed to load PDF copy from storage provider', { error: readErr.message });
        }
      }

      if (!buffer) {
        throw new Error('PDF file buffer not found in job and original.pdf is missing from storage.');
      }

      await workspaceContainer.ingestionService.runPdfIngest(workspaceId, sourceId, buffer, fileName);
    } else if (type === 'text') {
      await workspaceContainer.ingestionService.runTextIngest(workspaceId, sourceId, text, title);
    } else if (type === 'deep-enrich') {
      await workspaceContainer.ingestionService.runDeepEnrichment(workspaceId, sourceId);
    } else {
      throw new Error(`Unsupported source ingestion type: ${type}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 4,          // 4 concurrent: caption jobs are I/O-light, enrichment is heavier
    stalledInterval: 300000, // Check stalled every 5 minutes
    lockDuration: 300000,    // 5-minute lock — prevents false stalled during long AssemblyAI polls
    lockRenewTime: 60000,    // Renew every 60s
    metrics: { maxDataPoints: 0 },
  }
);

workspaceWorker.on('completed', (job) => {
  logger.info(`Workspace ingestion job ${job.id} completed successfully`);
});

workspaceWorker.on('failed', (job, err) => {
  logger.error(`Workspace ingestion job ${job?.id} failed: ${err.message}`, { stack: err.stack });
});

export default workspaceWorker;
