import { EventEmitter } from 'events';
import logger from '../../loggers/logger.js';

class WorkspaceIngestionStateMachine extends EventEmitter {
  constructor({ workspaceSourceRepository }) {
    super();
    this.sourceRepo = workspaceSourceRepository;

    // Supported source ingestion lifecycle states
    this.validStates = new Set([
      'queued',
      'uploading',
      'validating',
      'parsing',
      'extracting_audio',
      'generating_transcript',
      'enhancing_transcript',
      'semantic_cleaning',
      'chunking',
      'embedding',
      'indexing',
      'graph_building',
      'partially_ready',
      'transcript_ready',
      'vector_ready',
      'graph_ready',
      'completed',
      'failed',
      'retrying',
      'cancelled',
      'ready_without_vectors',
      'indexing_pending',
      'indexing_retrying',
      'fully_indexed',
    ]);

    // Terminal states that cannot transition further (except maybe retrying or cancelled)
    this.terminalStates = new Set(['completed', 'failed', 'cancelled', 'fully_indexed']);
  }

  /**
   * Derive granular component statuses based on the macro pipeline state.
   */
  _deriveIndexingStatus(nextState, currentState, existingStatus = {}) {
    const status = {
      extraction: existingStatus?.extraction || 'pending',
      chunking: existingStatus?.chunking || 'pending',
      embedding: existingStatus?.embedding || 'pending',
      vectorIndexing: existingStatus?.vectorIndexing || 'pending',
      retrievalReadinessScore: existingStatus?.retrievalReadinessScore || 0
    };

    switch (nextState) {
      case 'validating':
      case 'parsing':
      case 'extracting_audio':
        status.extraction = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 10);
        break;
      case 'generating_transcript':
      case 'enhancing_transcript':
      case 'semantic_cleaning':
        status.extraction = 'completed';
        status.chunking = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 30);
        break;
      case 'chunking':
        status.extraction = 'completed';
        status.chunking = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 45);
        break;
      case 'embedding':
      case 'indexing':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'pending';
        status.vectorIndexing = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 70);
        break;
      case 'transcript_ready':
      case 'partially_ready':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 60);
        break;
      case 'ready_without_vectors':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'completed';
        status.vectorIndexing = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 75);
        break;
      case 'indexing_pending':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'completed';
        status.vectorIndexing = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 75);
        break;
      case 'indexing_retrying':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'completed';
        status.vectorIndexing = 'pending';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 80);
        break;
      case 'vector_ready':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'completed';
        status.vectorIndexing = 'completed';
        status.retrievalReadinessScore = Math.max(status.retrievalReadinessScore, 90);
        break;
      case 'completed':
      case 'graph_ready':
      case 'fully_indexed':
        status.extraction = 'completed';
        status.chunking = 'completed';
        status.embedding = 'completed';
        status.vectorIndexing = 'completed';
        status.retrievalReadinessScore = 100;
        break;
      case 'failed':
        if (currentState === 'transcript_ready' || currentState === 'ready_without_vectors') {
          status.extraction = 'completed';
          status.chunking = 'completed';
          status.vectorIndexing = 'failed';
          status.retrievalReadinessScore = 60;
        } else {
          status.extraction = status.extraction === 'completed' ? 'completed' : 'failed';
          status.chunking = status.chunking === 'completed' ? 'completed' : 'failed';
          status.embedding = status.embedding === 'completed' ? 'completed' : 'failed';
          status.vectorIndexing = 'failed';
        }
        break;
    }

    return status;
  }

  /**
   * Transition a source to a new lifecycle state
   * @param {string} workspaceId 
   * @param {string} sourceId 
   * @param {string} nextState 
   * @param {number} progress 0-100 percentage
   * @param {string} progressStage Human-readable stage description
   * @param {object} extraData Optional additional fields to merge in Firestore
   */
  async transitionTo(workspaceId, sourceId, nextState, progress, progressStage, extraData = {}) {
    if (!this.validStates.has(nextState)) {
      throw new Error(`Invalid ingestion state transition attempted: ${nextState}`);
    }

    try {
      // 1. Fetch current source state
      const source = await this.sourceRepo.findById(workspaceId, sourceId);
      if (!source) {
        logger.warn(`Ingestion state machine attempted transition on non-existent source`, {
          workspaceId,
          sourceId,
          nextState,
        });
        return null;
      }

      const currentState = source.status;

      // 2. Guard: Avoid re-entering terminal states unless retrying, updating, or recovering a failed state
      const isRecoveringFailed = currentState === 'failed' && ['retrying', 'indexing_pending', 'indexing_retrying', 'ready_without_vectors'].includes(nextState);
      if (this.terminalStates.has(currentState) && nextState !== 'retrying' && nextState !== 'failed' && !isRecoveringFailed) {
        logger.warn(`Ignored state transition from terminal state "${currentState}" to "${nextState}"`, {
          workspaceId,
          sourceId,
        });
        return source;
      }

      logger.info(`Ingestion transition [${currentState || 'pending'} ──► ${nextState}] for source ${sourceId} (${progress}%)`, {
        workspaceId,
        sourceId,
        stage: progressStage,
      });

      // 3. Derive progressive indexing metadata status
      const indexingStatus = this._deriveIndexingStatus(nextState, currentState, source.indexingStatus);

      // 4. Update repository
      const updatePayload = {
        status: nextState,
        progress: Math.min(Math.max(progress, 0), 100),
        progressStage,
        indexingStatus,
        updatedAt: new Date().toISOString(),
        ...extraData,
      };

      const updatedSource = await this.sourceRepo.update(workspaceId, sourceId, updatePayload);

      // 5. Emit event for SSE progress stream listeners
      const eventPayload = {
        workspaceId,
        sourceId,
        currentState,
        nextState,
        progress: updatePayload.progress,
        progressStage,
        indexingStatus,
        timestamp: updatePayload.updatedAt,
        extraData,
      };

      this.emit('transition', eventPayload);
      this.emit(`${workspaceId}:${sourceId}`, eventPayload);

      return updatedSource;
    } catch (error) {
      logger.error(`Ingestion state machine failed to transition source ${sourceId}`, {
        workspaceId,
        sourceId,
        nextState,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Helper to check if a status is terminal
   */
  isTerminal(status) {
    return this.terminalStates.has(status);
  }
}

export default WorkspaceIngestionStateMachine;
