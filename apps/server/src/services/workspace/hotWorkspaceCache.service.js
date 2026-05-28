import logger from '../../loggers/logger.js';

class HotWorkspaceCacheService {
  constructor({ redisClient, workspaceSourceRepository } = {}) {
    this.redis = redisClient;
    this.sourceRepo = workspaceSourceRepository;
    this.cacheTtlSec = 3600; // 1 hour hot cache TTL
  }

  _getKey(workspaceId, type) {
    return `ws:${workspaceId}:${type}`;
  }

  /**
   * Precomputes and caches all concept -> chunk mappings for a workspace
   */
  async precomputeWorkspaceMap(workspaceId) {
    if (!this.redis) return null;
    const startMs = Date.now();

    try {
      logger.info('Precomputing hot workspace semantic maps...', { workspaceId });
      const sources = await this.sourceRepo.findByWorkspace(workspaceId);
      
      const activeStatuses = ['ready', 'completed', 'fully_indexed', 'graph_ready'];
      const readySources = sources.filter(s => activeStatuses.includes(s.status));

      const conceptMap = {}; // conceptTag -> Array<{ text, sourceId, sourceTitle, chunkIndex }>
      const sourceTopicMap = {}; // sourceId -> topics
      const dependencyMap = {}; // prerequisite mappings

      for (const src of readySources) {
        const docId = src.id;
        
        // Build source -> topic map
        if (src.topicSegments) {
          sourceTopicMap[docId] = src.topicSegments.map(t => t.title);
          
          // Basic dependency mapping
          src.topicSegments.forEach(topic => {
            if (topic.keywords) {
              topic.keywords.forEach(kw => {
                dependencyMap[kw.toLowerCase()] = {
                  sourceId: docId,
                  topicTitle: topic.title
                };
              });
            }
          });
        }

        // Pull chunks from cache or construct them from source transcript
        if (src.transcript) {
          // Re-chunk locally if not stored in firestore
          const { default: container } = await import('../../container/workspaceContainer.js');
          const chunks = container.workspaceChunkingService.chunkText(src.transcript);

          chunks.forEach(chunk => {
            // Match chunk concept tags or extract definitions
            const lowerText = chunk.text.toLowerCase();
            const concepts = [];

            // Programmatic concept tagging
            if (chunk.sectionTitle) concepts.push(chunk.sectionTitle.toLowerCase());
            
            const defRegex = /\b([\w\s]{3,20})\s+(?:is defined as|means|refers to|is the process of|is a type of)\b/i;
            const defMatch = lowerText.match(defRegex);
            if (defMatch) {
              concepts.push(defMatch[1].trim());
            }

            concepts.forEach(concept => {
              if (!conceptMap[concept]) {
                conceptMap[concept] = [];
              }
              // Only cache top 3 most relevant chunk mappings per concept to keep cache size low
              if (conceptMap[concept].length < 3) {
                conceptMap[concept].push({
                  text: chunk.text,
                  sourceId: docId,
                  sourceTitle: src.title,
                  sourceType: src.type,
                  chunkIndex: chunk.chunkIndex,
                  startTime: chunk.startTime || null,
                  endTime: chunk.endTime || null,
                  pageNumber: chunk.pageNumber || null,
                  sectionTitle: chunk.sectionTitle || null,
                  relevance: 1.0,
                  semanticScore: 1.0
                });
              }
            });
          });
        }
      }

      // Write maps to Redis
      const mapKey = this._getKey(workspaceId, 'semantic_map');
      const topicKey = this._getKey(workspaceId, 'topic_map');
      const depKey = this._getKey(workspaceId, 'dependency_map');

      await Promise.all([
        this.redis.setex(mapKey, this.cacheTtlSec, JSON.stringify(conceptMap)),
        this.redis.setex(topicKey, this.cacheTtlSec, JSON.stringify(sourceTopicMap)),
        this.redis.setex(depKey, this.cacheTtlSec, JSON.stringify(dependencyMap))
      ]);

      logger.info('Precomputed and cached workspace semantic maps successfully', {
        workspaceId,
        conceptsCount: Object.keys(conceptMap).length,
        durationMs: Date.now() - startMs
      });

      return { conceptMap, sourceTopicMap, dependencyMap };
    } catch (err) {
      logger.error('Failed to precompute workspace maps', { error: err.message, workspaceId });
      return null;
    }
  }

  /**
   * Retrieves semantic map from Redis or precomputes if missing
   */
  async getSemanticMap(workspaceId) {
    if (!this.redis) return null;
    try {
      const mapKey = this._getKey(workspaceId, 'semantic_map');
      const cached = await this.redis.get(mapKey);
      if (cached) {
        return JSON.parse(cached);
      }
      const precomputed = await this.precomputeWorkspaceMap(workspaceId);
      return precomputed?.conceptMap || null;
    } catch (err) {
      logger.warn('Failed to fetch semantic map from Redis cache', { error: err.message });
      return null;
    }
  }

  /**
   * Search within the cached semantic map using exact or token matching
   */
  async searchCache(workspaceId, query, topK = 10) {
    const conceptMap = await this.getSemanticMap(workspaceId);
    if (!conceptMap) return null;

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const candidates = [];
    const seenText = new Set();

    for (const term of queryTerms) {
      // Find matching concepts in map
      for (const [concept, chunks] of Object.entries(conceptMap)) {
        if (concept.includes(term) || term.includes(concept)) {
          chunks.forEach(chunk => {
            if (!seenText.has(chunk.text)) {
              seenText.add(chunk.text);
              candidates.push(chunk);
            }
          });
        }
      }
    }

    if (candidates.length > 0) {
      logger.info('Hot Workspace Cache Hit!', { workspaceId, query, hits: candidates.length });
      return candidates.slice(0, topK);
    }

    return null;
  }

  /**
   * Clear cache for a workspace
   */
  async invalidate(workspaceId) {
    if (!this.redis) return;
    try {
      const keys = [
        this._getKey(workspaceId, 'semantic_map'),
        this._getKey(workspaceId, 'topic_map'),
        this._getKey(workspaceId, 'dependency_map')
      ];
      await this.redis.del(...keys);
      logger.info('Invalidated hot workspace cache', { workspaceId });
    } catch (err) {
      logger.warn('Failed to invalidate hot workspace cache', { error: err.message });
    }
  }
}

export default HotWorkspaceCacheService;
