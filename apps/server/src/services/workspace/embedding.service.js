import crypto from 'node:crypto';
import logger from '../../loggers/logger.js';
import AppError from '../../utils/AppError.js';
import { WORKSPACE_COLLECTION, ensureQdrantCollection } from '../../config/qdrant.js';

const UPSERT_BATCH_SIZE = 40; // Progressive upsert size
const RATE_LIMIT_DELAY_MS = 100;

class EmbeddingService {
  constructor({ 
    embeddingProviderRegistry, 
    qdrantClient, 
    config, 
    dbProvider,
    workspaceSourceRepository,
    workspaceIngestionStateMachine
  } = {}) {
    this.providerRegistry = embeddingProviderRegistry;
    this.qdrantClient = qdrantClient;
    this.config = config;
    this.dbProvider = dbProvider;
    this.sourceRepo = workspaceSourceRepository;
    this.stateMachine = workspaceIngestionStateMachine;
  }

  _computeSha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Generate a single embedding vector for the given text.
   * @param {string} text
   * @returns {Promise<number[]>} 1024-dimensional float array
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new AppError('Embedding input text is required', 400);
    }

    try {
      const results = await this.providerRegistry.generateEmbeddings([text], 'query');
      if (!results || results.length === 0) {
        throw new Error('No embeddings returned by registry');
      }
      return results[0];
    } catch (err) {
      logger.error('Embedding generation failed', {
        error: err.message,
      });
      throw new AppError('Failed to generate embedding', 502, { cause: err.message });
    }
  }

  /**
   * Generate embeddings for multiple texts in sequential batches.
   * @param {string[]} texts
   * @param {number} batchSize
   * @returns {Promise<number[][]>} Array of embedding vectors in input order
   */
  async generateBatchEmbeddings(texts, batchSize = 32) {
    if (!texts?.length) return [];

    const embeddings = [];
    const totalBatches = Math.ceil(texts.length / batchSize);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batch = texts.slice(i, i + batchSize);

      logger.info('Processing embedding batch', {
        batch: batchIndex,
        totalBatches,
        batchSize: batch.length,
      });

      try {
        const batchEmbeddings = await this.providerRegistry.generateEmbeddings(batch, 'passage');
        if (!batchEmbeddings || batchEmbeddings.length !== batch.length) {
          throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${batchEmbeddings?.length}`);
        }
        embeddings.push(...batchEmbeddings);
      } catch (err) {
        logger.error('Batch embedding failed', {
          batch: batchIndex,
          error: err.message,
        });
        throw new AppError('Batch embedding generation failed', 502, {
          batch: batchIndex,
          cause: err.message,
        });
      }

      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      }
    }

    return embeddings;
  }

  /**
   * Helper to generate a valid, deterministic UUID based on seed strings.
   */
  _generateDeterministicUUID(workspaceId, sourceId, chunkIndex) {
    const seed = `${workspaceId}_${sourceId}_${chunkIndex}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16),
      ((parseInt(hash.substring(16, 17), 16) % 4) + 8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Generate embeddings for chunks and upsert them into Qdrant.
   * Supports SHA-256 caching in Firestore, batch deduplication, and priority tiering.
   * @param {string} workspaceId
   * @param {string} sourceId
   * @param {Array<Object>} chunks
   * @returns {Promise<number>} Total number of indexed points
   */
  async indexChunks(workspaceId, sourceId, chunks) {
    if (!chunks?.length) return 0;

    await ensureQdrantCollection();

    // 1. Check Qdrant scroll resilience
    try {
      const existingPoints = await this.qdrantClient.scroll(WORKSPACE_COLLECTION, {
        filter: {
          must: [
            { key: 'workspaceId', match: { value: workspaceId } },
            { key: 'sourceId', match: { value: sourceId } },
          ],
        },
        limit: chunks.length + 10,
        with_vector: false,
        with_payload: false,
      });

      if (existingPoints && existingPoints.points && existingPoints.points.length === chunks.length) {
        logger.info('All chunks already fully indexed in Qdrant. Skipping indexing.', {
          workspaceId,
          sourceId,
          count: chunks.length
        });
        return chunks.length;
      }
    } catch (scrollErr) {
      logger.warn('Failed checking existing vectors in Qdrant (non-fatal)', { error: scrollErr.message });
    }

    // 2. Compute SHA-256 and Deduplicate / Batch fetch from Firestore Cache
    const uniqueHashesMap = new Map(); // hash -> text
    chunks.forEach(c => {
      const h = this._computeSha256(c.text);
      uniqueHashesMap.set(h, c.text);
    });

    const uniqueHashes = Array.from(uniqueHashesMap.keys());
    const cachedVectors = new Map(); // hash -> vector float[]

    if (this.dbProvider) {
      try {
        const firestoreBatchSize = 150;
        for (let i = 0; i < uniqueHashes.length; i += firestoreBatchSize) {
          const batchHashes = uniqueHashes.slice(i, i + firestoreBatchSize);
          const refs = batchHashes.map(h => this.dbProvider().collection('chunkEmbeddingsCache').doc(h));
          const docs = await this.dbProvider().getAll(...refs);
          docs.forEach(doc => {
            if (doc.exists) {
              cachedVectors.set(doc.id, doc.data().vector);
            }
          });
        }
        logger.info('Firestore chunk embedding cache hits checked', {
          totalUnique: uniqueHashes.length,
          cachedHits: cachedVectors.size
        });
      } catch (cacheFetchErr) {
        logger.warn('Failed to query chunk embeddings cache from Firestore (non-fatal)', { error: cacheFetchErr.message });
      }
    }

    // 3. Generate embeddings only for missing hashes
    const missingHashes = uniqueHashes.filter(h => !cachedVectors.has(h));
    const missingTexts = missingHashes.map(h => uniqueHashesMap.get(h));

    if (missingTexts.length > 0) {
      logger.info('Generating new embeddings for non-cached chunks...', { missingCount: missingTexts.length });
      const newEmbeddings = await this.generateBatchEmbeddings(missingTexts);
      
      // Store back to cache
      newEmbeddings.forEach((vector, idx) => {
        const hash = missingHashes[idx];
        cachedVectors.set(hash, vector);
      });

      if (this.dbProvider) {
        try {
          const batchWrite = this.dbProvider().batch();
          let opsCount = 0;
          missingHashes.forEach((hash, idx) => {
            const ref = this.dbProvider().collection('chunkEmbeddingsCache').doc(hash);
            batchWrite.set(ref, {
              vector: newEmbeddings[idx],
              createdAt: new Date().toISOString()
            });
            opsCount++;
            
            // Firestore batch write supports up to 500 ops
            if (opsCount >= 400) {
              batchWrite.commit();
              opsCount = 0;
            }
          });
          if (opsCount > 0) {
            await batchWrite.commit();
          }
          logger.info('Stored new embeddings to cache successfully');
        } catch (cacheWriteErr) {
          logger.warn('Failed to write new embeddings to cache (non-fatal)', { error: cacheWriteErr.message });
        }
      }
    }

    // 4. Map chunks to points and sort by priority tier
    const mappedChunks = chunks.map(chunk => {
      const hash = this._computeSha256(chunk.text);
      const vector = cachedVectors.get(hash);
      
      return {
        ...chunk,
        vector,
      };
    });

    // Sort by priority tier (Tier 1 is highest priority -> Tier 2 -> Tier 3)
    mappedChunks.sort((a, b) => (a.priorityTier || 3) - (b.priorityTier || 3));

    // 5. Progressive upsert to Qdrant in batches of UPSERT_BATCH_SIZE
    let indexedCount = 0;
    const totalChunks = mappedChunks.length;

    for (let i = 0; i < mappedChunks.length; i += UPSERT_BATCH_SIZE) {
      const batch = mappedChunks.slice(i, i + UPSERT_BATCH_SIZE);
      const points = batch.map(chunk => ({
        id: this._generateDeterministicUUID(workspaceId, sourceId, chunk.chunkIndex),
        vector: chunk.vector,
        payload: {
          workspaceId,
          sourceId,
          sourceType: chunk.sourceType || 'document',
          sourceTitle: chunk.sourceTitle || 'Untitled Source',
          chunkIndex: chunk.chunkIndex,
          chunkType: chunk.chunkType || 'semantic',
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          startTime: chunk.startTime ?? null,
          endTime: chunk.endTime ?? null,
          pageNumber: chunk.pageNumber ?? null,
          sectionTitle: chunk.sectionTitle ?? null,
          semanticLabel: chunk.semanticLabel ?? null,
          conceptTags: chunk.conceptTags || [],
          importance: chunk.importance ?? 0.5,
          priorityTier: chunk.priorityTier || 3,
        },
      }));

      await this.qdrantClient.upsert(WORKSPACE_COLLECTION, {
        wait: true,
        points,
      });

      indexedCount += batch.length;
      
      // Update progress in state machine
      if (this.stateMachine) {
        const progressPct = Math.min(80 + Math.round((indexedCount / totalChunks) * 16), 96);
        const activeTier = batch[0].priorityTier || 3;
        await this.stateMachine.transitionTo(
          workspaceId,
          sourceId,
          'indexing',
          progressPct,
          `Vector indexing active (Priority Tier ${activeTier}) ... [${indexedCount}/${totalChunks} chunks]`,
          {
            indexingStatus: {
              extraction: 'completed',
              chunking: 'completed',
              embedding: 'completed',
              vectorIndexing: 'indexing',
              retrievalReadinessScore: Math.min(60 + Math.round((indexedCount / totalChunks) * 35), 95),
            }
          }
        );
      }

      logger.info('Qdrant progressive batch indexed successfully', {
        workspaceId,
        sourceId,
        indexedCount,
        total: totalChunks,
      });
    }

    logger.info('Hierarchical progressive indexing complete', {
      workspaceId,
      sourceId,
      totalIndexed: indexedCount,
    });

    return indexedCount;
  }

  /**
   * Delete all vectors for a specific source within a workspace.
   * @param {string} workspaceId
   * @param {string} sourceId
   */
  async deleteSourceVectors(workspaceId, sourceId) {
    await this.qdrantClient.delete(WORKSPACE_COLLECTION, {
      filter: {
        must: [
          { key: 'workspaceId', match: { value: workspaceId } },
          { key: 'sourceId', match: { value: sourceId } },
        ],
      },
    });

    logger.info('Source vectors deleted', { workspaceId, sourceId });
  }

  /**
   * Delete all vectors for an entire workspace.
   * @param {string} workspaceId
   */
  async deleteWorkspaceVectors(workspaceId) {
    await this.qdrantClient.delete(WORKSPACE_COLLECTION, {
      filter: {
        must: [{ key: 'workspaceId', match: { value: workspaceId } }],
      },
    });

    logger.info('Workspace vectors deleted', { workspaceId });
  }

  /**
   * Retrieve Qdrant collection info for diagnostics.
   * @returns {Promise<Object>}
   */
  async getCollectionInfo() {
    return this.qdrantClient.getCollection(WORKSPACE_COLLECTION);
  }
}

export default EmbeddingService;
