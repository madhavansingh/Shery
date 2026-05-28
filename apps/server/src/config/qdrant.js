import { QdrantClient } from '@qdrant/js-client-rest';
import config from './env.js';
import logger from '../loggers/logger.js';

const COLLECTION_NAME = 'workspace_chunks';
const VECTOR_SIZE = 1024;

class QdrantConfig {
  constructor() {
    this.client = null;
    this.collectionReady = false;
    this.initPromise = null;
    this.startupTime = Date.now();
    
    // Simple health caching to prevent spamming connections when unhealthy
    this.lastHealthCheck = null;
    this.lastHealthCheckTime = 0;
  }

  getClient() {
    if (!this.client) {
      // Connect to Qdrant Client with a explicit timeout (e.g. 5 seconds) to avoid blocking
      this.client = new QdrantClient({
        url: config.qdrantUrl,
        ...(config.qdrantApiKey ? { apiKey: config.qdrantApiKey } : {}),
        timeout: 5000,
      });
      logger.info('Qdrant client initialized', { url: config.qdrantUrl });
    }
    return this.client;
  }

  /**
   * Safe, idempotent setup of Qdrant collection.
   * Utilizes a singleton lock (promise) to prevent concurrent races.
   */
  async ensureCollection() {
    if (this.collectionReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = this.getClient();
      const maxRetries = 3;
      let delayMs = 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`Validating Qdrant collection existence (Attempt ${attempt}/${maxRetries})...`);
          
          // Test connection by listing collections
          const collections = await client.getCollections();
          const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

          if (!exists) {
            logger.info(`Creating missing Qdrant collection: "${COLLECTION_NAME}"...`);
            try {
              await client.createCollection(COLLECTION_NAME, {
                vectors: {
                  size: VECTOR_SIZE,
                  distance: 'Cosine',
                },
                optimizers_config: {
                  default_segment_number: 2,
                },
                replication_factor: 1,
              });
            } catch (createErr) {
              if (
                createErr.message?.includes('already exists') || 
                createErr.status === 409 || 
                createErr.message?.includes('409')
              ) {
                logger.info(`Collection "${COLLECTION_NAME}" already exists (concurrent creation ignored).`);
              } else {
                throw createErr;
              }
            }

            // Create payload index for fast filtering
            try {
              await client.createPayloadIndex(COLLECTION_NAME, {
                field_name: 'workspaceId',
                field_schema: 'keyword',
              });
              await client.createPayloadIndex(COLLECTION_NAME, {
                field_name: 'sourceId',
                field_schema: 'keyword',
              });
            } catch (indexErr) {
              logger.warn('Non-blocking payload index creation warning', { error: indexErr.message });
            }

            logger.info('Qdrant collection created successfully.', { name: COLLECTION_NAME });
          }

          this.collectionReady = true;
          this.initPromise = null;
          return;
        } catch (err) {
          logger.warn(`Qdrant collection setup attempt ${attempt} failed`, { error: err.message });
          
          if (attempt === maxRetries) {
            this.initPromise = null;
            throw new Error(`Failed to ensure Qdrant collection after ${maxRetries} attempts. Connection error: ${err.message}`);
          }
          
          // Exponential backoff delay
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2;
        }
      }
    })();

    return this.initPromise;
  }

  /**
   * Resilient healthcheck with connection timeout ping
   */
  async healthCheck() {
    const now = Date.now();
    // Cache unhealthy checks for 5 seconds to prevent hammering network sockets
    if (this.lastHealthCheck && !this.lastHealthCheck.healthy && (now - this.lastHealthCheckTime < 5000)) {
      return this.lastHealthCheck;
    }

    try {
      const client = this.getClient();
      // Enforce connection timeout for the health check request
      const collections = await Promise.race([
        client.getCollections(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 2500))
      ]);
      
      this.lastHealthCheck = { healthy: true, collections: collections.collections.length };
      this.lastHealthCheckTime = now;
      return this.lastHealthCheck;
    } catch (err) {
      const isGracePeriod = (now - this.startupTime) < 120000;
      if (isGracePeriod) {
        logger.info('Qdrant offline during startup grace window (non-fatal)', { error: err.message });
      } else {
        logger.warn('Qdrant connection healthcheck failed', { error: err.message });
      }
      
      this.lastHealthCheck = { 
        healthy: false, 
        degraded: true,
        error: err.message,
        isGracePeriod
      };
      this.lastHealthCheckTime = now;
      return this.lastHealthCheck;
    }
  }
}

const qdrantConfig = new QdrantConfig();

export const getQdrantClient = () => qdrantConfig.getClient();
export const ensureQdrantCollection = () => qdrantConfig.ensureCollection();
export const qdrantHealthCheck = () => qdrantConfig.healthCheck();
export const WORKSPACE_COLLECTION = COLLECTION_NAME;
export const EMBEDDING_DIMENSIONS = VECTOR_SIZE;
export default qdrantConfig;
