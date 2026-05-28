import logger from '../../loggers/logger.js';
import { qdrantHealthCheck, ensureQdrantCollection } from '../../config/qdrant.js';

class VectorInfrastructureManager {
  constructor({ dbProvider, embeddingService, workspaceSourceRepository }) {
    this.getDb = dbProvider;
    this.embeddingService = embeddingService;
    this.sourceRepo = workspaceSourceRepository;
    
    this.isQdrantHealthy = false;
    this.heartbeatTimer = null;
    this.isFlushing = false;

    // Start health check heartbeat immediately (skipped in test environments)
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      this.startHeartbeat();
    }
  }

  collection() {
    return this.getDb().collection('deferred_indexing_jobs');
  }

  /**
   * Start background health check and queue flusher heartbeat
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    logger.info('Vector infrastructure manager heartbeat initiated');
    
    // Initial immediate check
    this.checkHealthAndFlush();

    // Poll Qdrant health and flush queue every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      this.checkHealthAndFlush();
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check Qdrant connection and flush queued indexing jobs if online
   */
  async checkHealthAndFlush() {
    try {
      const check = await qdrantHealthCheck();
      this.isQdrantHealthy = !!check.healthy;

      if (this.isQdrantHealthy) {
        // Ensure Qdrant collection is prepared before any flushing
        await ensureQdrantCollection().catch(err => {
          logger.error('Failed to ensure Qdrant collection during health flush', { error: err.message });
          this.isQdrantHealthy = false;
        });
      }

      logger.info('Qdrant infrastructure healthcheck', { healthy: this.isQdrantHealthy });

      if (this.isQdrantHealthy && !this.isFlushing) {
        await this.flushQueue();
      }
    } catch (err) {
      this.isQdrantHealthy = false;
      logger.warn('Qdrant infrastructure healthcheck encountered an error', { error: err.message });
    }
  }

  /**
   * Queue a list of chunks to be indexed once Qdrant is available/healthy
   */
  async queueIndexingJob(workspaceId, sourceId, chunks) {
    logger.info('Queueing deferred vector indexing job in Firestore', { workspaceId, sourceId, chunkCount: chunks.length });
    
    // Transition source status to indexing_pending
    const { default: container } = await import('../../container/workspaceContainer.js');
    await container.workspaceIngestionStateMachine.transitionTo(
      workspaceId,
      sourceId,
      'indexing_pending',
      88,
      'Vector indexing queued. Grounded chat active in BM25 fallback mode.'
    );

    const jobId = `${workspaceId}_${sourceId}`;
    const jobData = {
      jobId,
      workspaceId,
      sourceId,
      chunks,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.collection().doc(jobId).set(jobData);
    return jobId;
  }

  /**
   * Scan Firestore for pending indexing jobs and process them sequentially
   */
  async flushQueue() {
    this.isFlushing = true;
    try {
      // Look for pending, failed, or retrying jobs
      const snapshot = await this.collection()
        .where('status', 'in', ['pending', 'failed', 'retrying'])
        .limit(5)
        .get();

      if (snapshot.empty) {
        this.isFlushing = false;
        return;
      }

      logger.info(`Vector infrastructure flushing ${snapshot.size} deferred indexing jobs...`);
      const { default: container } = await import('../../container/workspaceContainer.js');

      for (const doc of snapshot.docs) {
        const job = doc.data();
        
        // Skip job if attempts are exhausted (max 10 retries to prevent stuck loops)
        if (job.attempts >= 10) {
          logger.warn(`Vector indexing job ${job.jobId} exceeded maximum retries. Skipping.`, { job });
          await this.collection().doc(job.jobId).update({
            status: 'exhausted',
            updatedAt: new Date().toISOString()
          });

          await container.workspaceIngestionStateMachine.transitionTo(
            job.workspaceId,
            job.sourceId,
            'ready_without_vectors',
            88,
            'Vector indexing retries exhausted. Grounded chat remains active in degraded mode.'
          );
          continue;
        }

        try {
          logger.info(`Starting deferred vector indexing for source: ${job.sourceId}...`);
          
          // Transition source to indexing_retrying
          await container.workspaceIngestionStateMachine.transitionTo(
            job.workspaceId,
            job.sourceId,
            'indexing_retrying',
            90,
            `Indexing vectors (Attempt ${Math.floor(job.attempts) + 1})...`
          );

          // Index chunks (idempotent, UUID-stable upsert)
          const indexedCount = await this.embeddingService.indexChunks(job.workspaceId, job.sourceId, job.chunks);
          
          // Remove job from Firestore queue upon success
          await this.collection().doc(job.jobId).delete();

          // Transition source status to vector_ready
          await container.workspaceIngestionStateMachine.transitionTo(
            job.workspaceId,
            job.sourceId,
            'vector_ready',
            95,
            'Vectors indexed successfully. Rebuilding concept map...'
          );

          // Rebuild graph
          try {
            await container.sourceGraphService.buildGraph(job.workspaceId);
            
            await container.workspaceIngestionStateMachine.transitionTo(
              job.workspaceId,
              job.sourceId,
              'completed',
              100,
              'Processing complete — ready for grounded AI chat.'
            );
            
            await container.ingestionService.postIngestionUpdate(job.workspaceId);
          } catch (graphErr) {
            logger.warn('Failed to rebuild graph during deferred flush transition (non-blocking)', { error: graphErr.message });
            
            // Still mark completed even if graph failed
            await container.workspaceIngestionStateMachine.transitionTo(
              job.workspaceId,
              job.sourceId,
              'completed',
              100,
              'Processing complete — ready for grounded AI chat.'
            );
          }

          logger.info(`Deferred vector indexing complete for source: ${job.sourceId}`, { indexedCount });
        } catch (err) {
          logger.error(`Deferred indexing job failed for job: ${job.jobId}`, { error: err.message });
          
          const isNetworkError = err.message?.includes('fetch failed') || err.message?.includes('Connection') || err.message?.includes('timeout') || err.message?.includes('Qdrant');
          
          // Increment attempts slower for temporary connectivity issues
          const newAttempts = (job.attempts || 0) + (isNetworkError ? 0.5 : 1);

          await this.collection().doc(job.jobId).update({
            status: 'failed',
            attempts: newAttempts,
            error: err.message,
            updatedAt: new Date().toISOString()
          });

          await container.workspaceIngestionStateMachine.transitionTo(
            job.workspaceId,
            job.sourceId,
            'ready_without_vectors',
            88,
            `Indexing deferred: ${err.message}`
          );
        }
      }
    } catch (err) {
      logger.error('Failed to flush deferred indexing jobs', { error: err.message });
    } finally {
      this.isFlushing = false;
    }
  }

  async getHealth() {
    return {
      healthy: this.isQdrantHealthy,
      queueSize: await this.collection().get().then(s => s.size).catch(() => 0)
    };
  }
}

export default VectorInfrastructureManager;
