import { Worker } from 'bullmq';
import { redisConnection } from '../infrastructure/redis.js';
import workspaceContainer from '../container/workspaceContainer.js';
import logger from '../loggers/logger.js';

export const workspaceUploadWorker = new Worker(
  'workspace-upload-queue',
  async (job) => {
    const { workspaceId, sourceId, fileName, storagePath, title } = job.data;

    logger.info(`Starting workspace video ingestion job ${job.id}`, {
      sourceId,
      workspaceId,
      storagePath,
      attempt: job.attemptsMade + 1,
    });

    const storageService = workspaceContainer.workspaceStorageService;

    // Resolve a local temp path for FFmpeg processing
    // For Supabase storage: download the original video to a temp dir
    // For local storage: the storagePath already points to a local file
    let videoPath = storagePath;
    let tempDir = null;
    let tempFile = null;

    if (storagePath && storagePath.startsWith('supabase:')) {
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `ws-vid-${sourceId}-`));
      const ext = path.extname(fileName) || '.mp4';

      try {
        tempFile = await storageService.downloadToTempFile(
          workspaceId,
          sourceId,
          `original${ext}`,
          tempDir
        );
        videoPath = tempFile;
        logger.info('Downloaded video from Supabase to temp for FFmpeg', { sourceId, tempFile });
      } catch (downloadErr) {
        logger.error('Failed to download video from Supabase for processing', { error: downloadErr.message });
        throw downloadErr;
      }
    } else if (storagePath && storagePath.startsWith('local:')) {
      // Strip the 'local:' prefix to get the absolute path
      videoPath = storagePath.replace(/^local:/, '');
    }

    try {
      await workspaceContainer.workspaceLocalVideoPipeline.run(
        workspaceId,
        sourceId,
        videoPath,
        fileName,
        title
      );
      logger.info(`Video ingestion completed successfully for source: ${sourceId}`);
    } finally {
      // Always clean up temp dir after processing (regardless of success/failure)
      if (tempDir) {
        try {
          const fs = await import('fs');
          fs.rmSync(tempDir, { recursive: true, force: true });
          logger.info('Cleaned up temp video dir', { tempDir });
        } catch (cleanupErr) {
          logger.warn('Failed to clean temp video dir', { tempDir, error: cleanupErr.message });
        }
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,          // 3 concurrent: fast-path is now just seg0 transcription
    stalledInterval: 300000, // Check stalled every 5 minutes
    lockDuration: 300000,    // 5-minute lock — covers full FFmpeg segmentation
    lockRenewTime: 60000,    // Renew every 60s
    metrics: { maxDataPoints: 0 },
  }
);

workspaceUploadWorker.on('completed', (job) => {
  logger.info(`Workspace video ingestion job ${job.id} completed successfully`);
});

workspaceUploadWorker.on('failed', (job, err) => {
  logger.error(`Workspace video ingestion job ${job?.id} failed: ${err.message}`, { stack: err.stack });
});

export default workspaceUploadWorker;
