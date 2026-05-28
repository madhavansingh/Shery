import fs from 'fs';
import path from 'path';
import logger from '../../loggers/logger.js';

class WorkspaceCleanupManager {
  constructor({ embeddingService, workspaceStorageService, workspaceSourceRepository }) {
    this.embeddingService = embeddingService;
    this.storageService = workspaceStorageService;
    this.sourceRepo = workspaceSourceRepository;
  }

  /**
   * Idempotently rolls back a failed or cancelled source ingestion.
   * Purges partial vector indices, temp files, and updates source logs safely.
   */
  /**
   * Idempotently rolls back a failed or cancelled source ingestion.
   * Purges partial vector indices, intermediate temp files, and updates source logs safely.
   * @param {string} workspaceId
   * @param {string} sourceId
   * @param {Error} error
   * @param {boolean} isFinalDestruction True if user requested manual delete or retry limit exhausted
   */
  async rollbackSource(workspaceId, sourceId, error = null, isFinalDestruction = false) {
    logger.info(`Starting cascade rollback cleanup for Source: ${sourceId} in Workspace: ${workspaceId} (Final Destruction: ${isFinalDestruction})`);

    // 1. Resiliently delete Qdrant vectors
    try {
      logger.info(`Purging partially generated vector points from Qdrant...`, { sourceId });
      await this.embeddingService.deleteSourceVectors(workspaceId, sourceId);
    } catch (vectorErr) {
      // If Qdrant fails (offline/timeout), log warning but proceed so we don't block cleaning other resources
      logger.warn(`Non-blocking Qdrant vector deletion failure during source rollback`, {
        sourceId,
        error: vectorErr.message,
      });
    }

    // 2. Cascade delete source files from the active storage provider
    try {
      if (isFinalDestruction) {
        logger.info(`Purging source files from storage provider (final destruction)`, { workspaceId, sourceId });
        await this.storageService.deleteSourceDir(workspaceId, sourceId);
      } else {
        // Selective cleanup: only delete intermediate local files, preserve original uploads
        // (Intermediate files like audio segments, thumbnails are always local regardless of storage provider)
        const sourceDir = this.storageService.resolveSourceDir(workspaceId, sourceId);
        if (fs.existsSync(sourceDir)) {
          logger.info(`Selectively purging intermediate files in source directory: ${sourceDir}`);
          const items = fs.readdirSync(sourceDir);
          for (const item of items) {
            const itemPath = path.join(sourceDir, item);
            const isOriginal = item.startsWith('original.');
            if (!isOriginal) {
              if (fs.statSync(itemPath).isDirectory()) {
                fs.rmSync(itemPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(itemPath);
              }
            }
          }
        }
      }
    } catch (storageErr) {
      logger.error(`Failed to clean up storage files during rollback`, {
        sourceId,
        error: storageErr.message,
      });
    }

    // 3. Mark the source state as failed if not already, appending details
    try {
      const sourceDoc = await this.sourceRepo.findById(workspaceId, sourceId);
      if (sourceDoc && sourceDoc.status !== 'failed' && sourceDoc.status !== 'cancelled') {
        const errorMsg = error?.message || 'Ingestion interrupted or aborted.';
        const suggestedAction = error?.suggestedAction || 'Please verify the source file format and retry upload.';
        
        await this.sourceRepo.update(workspaceId, sourceId, {
          status: 'failed',
          progress: 0,
          progressStage: 'Failed & rolled back.',
          error: errorMsg,
          errorDetails: {
            code: error?.code || 'INGESTION_FAILED',
            suggestedAction,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (dbErr) {
      logger.error(`Failed to update final error status in Firestore repository during rollback`, {
        sourceId,
        error: dbErr.message,
      });
    }

    logger.info(`Completed cascade rollback cleanup successfully for Source: ${sourceId}`);
  }

  /**
   * Cleans orphan files in workspace directory that don't match active Firestore records
   */
  async sweepOrphanWorkspaceFiles(workspaceId) {
    try {
      const workspaceDir = path.join(this.storageService.baseUploadDir, workspaceId);
      if (!fs.existsSync(workspaceDir)) return;

      const activeSources = await this.sourceRepo.findByWorkspace(workspaceId);
      const activeIds = new Set(activeSources.map(s => s.id));

      const subdirs = fs.readdirSync(workspaceDir);
      for (const dirName of subdirs) {
        if (!activeIds.has(dirName)) {
          const orphanPath = path.join(workspaceDir, dirName);
          logger.info(`Detected orphan ingestion folder: ${orphanPath}. Purging programmatically...`);
          fs.rmSync(orphanPath, { recursive: true, force: true });
        }
      }
    } catch (err) {
      logger.warn(`Orphan directory sweeping encounter a non-blocking error`, { error: err.message });
    }
  }
}

export default WorkspaceCleanupManager;
