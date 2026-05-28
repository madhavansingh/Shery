import logger from '../../loggers/logger.js';

class WorkspaceUploadTelemetryService {
  constructor({ ingestionTracerService }) {
    this.tracer = ingestionTracerService;
  }

  /**
   * Starts timing a specific video ingestion stage
   */
  async startStage(workspaceId, sourceId, stageName) {
    await this.tracer.startTrace(workspaceId, sourceId, `video_upload:${stageName}`);
  }

  /**
   * Ends timing for a specific video ingestion stage
   */
  async endStage(workspaceId, sourceId, stageName, meta = {}) {
    await this.tracer.endTrace(workspaceId, sourceId, `video_upload:${stageName}`, meta);
  }

  /**
   * Log comprehensive ingestion summary metrics
   */
  logIngestionMetrics(workspaceId, sourceId, stats) {
    logger.info('Workspace video upload ingestion completed successfully', {
      workspaceId,
      sourceId,
      videoSizeMb: ((stats.videoSizeBytes || 0) / (1024 * 1024)).toFixed(2),
      videoDurationSec: stats.videoDurationSec || 0,
      totalDurationMs: stats.totalDurationMs || 0,
      audioExtractionMs: stats.audioExtractionMs || 0,
      transcriptionMs: stats.transcriptionMs || 0,
      enhancementMs: stats.enhancementMs || 0,
      framesExtractionMs: stats.framesExtractionMs || 0,
      chunkingMs: stats.chunkingMs || 0,
      indexingMs: stats.indexingMs || 0,
    });
  }
}

export default WorkspaceUploadTelemetryService;
