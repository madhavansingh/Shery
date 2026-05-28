import logger from '../../loggers/logger.js';

class IngestionTracerService {
  constructor({ workspaceSourceRepository }) {
    this.sourceRepo = workspaceSourceRepository;
    this.activeTraces = new Map(); // Key: wid:sid:stage -> startTime
  }

  async startTrace(workspaceId, sourceId, stage) {
    const key = `${workspaceId}:${sourceId}:${stage}`;
    this.activeTraces.set(key, Date.now());
    logger.info(`Trace started: ${stage}`, { workspaceId, sourceId });
  }

  async endTrace(workspaceId, sourceId, stage, meta = {}) {
    const key = `${workspaceId}:${sourceId}:${stage}`;
    const startTime = this.activeTraces.get(key);
    if (!startTime) {
      logger.warn(`No active trace found to end for stage: ${stage}`, { workspaceId, sourceId });
      return;
    }
    this.activeTraces.delete(key);
    const durationMs = Date.now() - startTime;

    logger.info(`Trace ended: ${stage} (${durationMs}ms)`, { workspaceId, sourceId, ...meta });

    try {
      const source = await this.sourceRepo.findById(workspaceId, sourceId);
      if (source) {
        const traceEntry = {
          stage,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
          meta
        };
        const currentTrace = source.processingTrace || [];
        await this.sourceRepo.update(workspaceId, sourceId, {
          processingTrace: [...currentTrace, traceEntry]
        });
      }
    } catch (error) {
      logger.error('Failed to save trace entry in source repository', { error: error.message, workspaceId, sourceId });
    }
  }

  logVectorSearchTiming(workspaceId, query, durationMs, resultCount) {
    logger.info(`Vector search latency: ${durationMs}ms`, { workspaceId, query, resultCount });
  }

  logEmbeddingTiming(chunkCount, durationMs) {
    logger.info(`Embedding batch generation timing: ${durationMs}ms for ${chunkCount} chunks`);
  }

  logTokenUsage(workspaceId, inputTokens, outputTokens, model) {
    logger.info('Token usage recorded', { workspaceId, inputTokens, outputTokens, model });
  }

  async getProcessingTrace(workspaceId, sourceId) {
    const source = await this.sourceRepo.findById(workspaceId, sourceId);
    return source?.processingTrace || [];
  }

  async getWorkspaceMetrics(workspaceId, { workspaceRepo, sourceRepo, outputRepo }) {
    try {
      const workspace = await workspaceRepo.findById(workspaceId);
      const sources = await sourceRepo.findByWorkspace(workspaceId);
      const outputs = await outputRepo.findByWorkspace(workspaceId);

      const totalSources = sources.length;
      let totalChunks = 0;
      let totalDurationSec = 0;
      let totalPages = 0;

      const latencyTraces = [];
      const ingestionTimesByType = { youtube: [], pdf: [], text: [] };

      for (const source of sources) {
        totalChunks += source.chunkCount || 0;
        if (source.type === 'youtube') {
          totalDurationSec += source.meta?.duration || 0;
        } else if (source.type === 'pdf') {
          totalPages += source.meta?.pages || 0;
        }

        // Calculate average ingestion time from processingTrace
        if (source.processingTrace?.length) {
          const totalIngestTime = source.processingTrace.reduce((sum, t) => sum + (t.durationMs || 0), 0);
          if (ingestionTimesByType[source.type]) {
            ingestionTimesByType[source.type].push(totalIngestTime);
          }
        }
      }

      const avgIngestionTime = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

      return {
        name: workspace?.name || '',
        emoji: workspace?.emoji || '🧠',
        totalSources,
        totalChunks,
        totalOutputs: outputs.length,
        totalDurationSec,
        totalPages,
        avgIngestionTimeYoutube: avgIngestionTime(ingestionTimesByType.youtube),
        avgIngestionTimePdf: avgIngestionTime(ingestionTimesByType.pdf),
        avgIngestionTimeText: avgIngestionTime(ingestionTimesByType.text),
      };
    } catch (error) {
      logger.error('Failed to get workspace metrics', { error: error.message, workspaceId });
      return {
        totalSources: 0,
        totalChunks: 0,
        totalOutputs: 0,
        totalDurationSec: 0,
        totalPages: 0,
      };
    }
  }
}

export default IngestionTracerService;
