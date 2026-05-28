import logger from '../../loggers/logger.js';

class ContextManagerService {
  constructor({ embeddingService }) {
    this.embeddingService = embeddingService;
  }

  async assembleContext(chunks, query, opts = {}) {
    const {
      maxTokens = 3000,
      diversityWeight = 0.3,
      recencyWeight = 0.1,
    } = opts;

    if (!chunks?.length) {
      return { contextText: '', sourcesUsed: [], tokenCount: 0, chunksUsed: 0 };
    }

    // Step 1: Semantic deduplication
    const deduplicated = this.deduplicateChunks(chunks);

    // Step 2: Multi-signal ranking
    const ranked = this.rankChunks(deduplicated, query, { diversityWeight, recencyWeight });

    // Step 3: Token-aware selection
    const selected = this.selectWithinBudget(ranked, maxTokens);

    // Step 4: Source diversity enforcement
    const diversified = this.enforceSourceDiversity(selected);

    // Step 5: Build context string with source attribution
    const contextText = this.buildContextString(diversified);
    const sourcesUsed = this.extractSourcesUsed(diversified);
    const tokenCount = this.estimateTokens(contextText);

    logger.info('Context assembled', {
      inputChunks: chunks.length,
      deduplicated: deduplicated.length,
      selected: diversified.length,
      tokenCount,
    });

    return { contextText, sourcesUsed, tokenCount, chunksUsed: diversified.length };
  }

  deduplicateChunks(chunks) {
    if (chunks.length <= 1) return chunks;

    const kept = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const candidate = chunks[i];
      const isDuplicate = kept.some((existing) => {
        const similarity = this.textSimilarity(existing.text, candidate.text);
        return similarity > 0.85;
      });

      if (!isDuplicate) {
        kept.push(candidate);
      }
    }

    return kept;
  }

  textSimilarity(a, b) {
    const setA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const setB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    return intersection / Math.max(setA.size, setB.size);
  }

  rankChunks(chunks, query, weights) {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter((t) => t.length > 2));

    const scored = chunks.map((chunk, index) => {
      // Relevance score (from retrieval, already sorted)
      const relevanceScore = chunk.relevance || (1 - index * 0.03);

      // Query term overlap
      const chunkTerms = chunk.text.toLowerCase().split(/\s+/);
      const queryOverlap = chunkTerms.filter((t) => queryTerms.has(t)).length / Math.max(queryTerms.size, 1);

      // Position boost (earlier chunks from retrieval are generally better)
      const positionScore = 1 - (index / chunks.length) * 0.3;

      // Importance from metadata
      const importanceScore = chunk.importance || 0.5;

      const finalScore = (
        relevanceScore * 0.5
        + queryOverlap * 0.2
        + positionScore * 0.15
        + importanceScore * 0.15
      );

      return { ...chunk, _rankScore: finalScore };
    });

    return scored.sort((a, b) => b._rankScore - a._rankScore);
  }

  selectWithinBudget(rankedChunks, maxTokens) {
    const selected = [];
    let usedTokens = 0;

    for (const chunk of rankedChunks) {
      const chunkTokens = chunk.tokenCount || this.estimateTokens(chunk.text);

      if (usedTokens + chunkTokens > maxTokens) {
        // Try to fit a compressed version
        const remaining = maxTokens - usedTokens;
        if (remaining > 50) {
          const compressed = this.compressChunk(chunk, remaining);
          if (compressed) {
            selected.push(compressed);
            usedTokens += this.estimateTokens(compressed.text);
          }
        }
        break;
      }

      selected.push(chunk);
      usedTokens += chunkTokens;
    }

    return selected;
  }

  compressChunk(chunk, targetTokens) {
    const sentences = chunk.text.split(/(?<=[.!?])\s+/);
    let compressed = '';
    let tokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      if (tokens + sentenceTokens > targetTokens) break;
      compressed += (compressed ? ' ' : '') + sentence;
      tokens += sentenceTokens;
    }

    if (!compressed) return null;
    return { ...chunk, text: compressed, tokenCount: tokens, _compressed: true };
  }

  enforceSourceDiversity(chunks, maxPerSource = 0.6) {
    if (chunks.length <= 2) return chunks;

    const sourceCounts = {};
    const maxFromSingle = Math.max(2, Math.ceil(chunks.length * maxPerSource));
    const result = [];

    for (const chunk of chunks) {
      const key = chunk.sourceId || 'unknown';
      sourceCounts[key] = (sourceCounts[key] || 0) + 1;

      if (sourceCounts[key] <= maxFromSingle) {
        result.push(chunk);
      }
    }

    return result;
  }

  buildContextString(chunks) {
    if (!chunks.length) return '';

    return chunks
      .map((chunk) => {
        const source = chunk.sourceTitle || 'Unknown Source';
        let location = '';
        if (chunk.startTime != null) {
          location = ` [${this.formatTime(chunk.startTime)}]`;
        } else if (chunk.pageNumber != null) {
          location = ` [Page ${chunk.pageNumber}]`;
        }
        const section = chunk.sectionTitle ? ` — ${chunk.sectionTitle}` : '';
        return `[Source: ${source}${location}${section}]\n${chunk.text}`;
      })
      .join('\n\n---\n\n');
  }

  extractSourcesUsed(chunks) {
    const seen = new Map();

    for (const chunk of chunks) {
      if (!chunk.sourceId) continue;
      if (!seen.has(chunk.sourceId)) {
        seen.set(chunk.sourceId, {
          sourceId: chunk.sourceId,
          sourceTitle: chunk.sourceTitle || 'Unknown',
          sourceType: chunk.sourceType,
          chunkCount: 0,
          timestamps: [],
          pages: [],
        });
      }

      const entry = seen.get(chunk.sourceId);
      entry.chunkCount++;

      if (chunk.startTime != null) {
        entry.timestamps.push({ start: chunk.startTime, end: chunk.endTime });
      }
      if (chunk.pageNumber != null && !entry.pages.includes(chunk.pageNumber)) {
        entry.pages.push(chunk.pageNumber);
      }
    }

    return Array.from(seen.values());
  }

  estimateTokens(text) {
    if (!text) return 0;
    // Approximate: 1 token ≈ 4 characters (English average)
    return Math.ceil(text.length / 4);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
}

export default ContextManagerService;
