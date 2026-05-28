import logger from '../../loggers/logger.js';

class WorkspaceMemoryService {
  constructor({ workspaceMemoryRepository }) {
    this.memoryRepo = workspaceMemoryRepository;
  }

  async recordInteraction(workspaceId, query, responseChunks) {
    try {
      const concepts = this.extractConcepts(query);
      const chunkConcepts = responseChunks
        .flatMap((c) => c.conceptTags || [])
        .filter(Boolean);

      const allConcepts = [...new Set([...concepts, ...chunkConcepts])];

      for (const term of allConcepts.slice(0, 10)) {
        await this.memoryRepo.addConcept(workspaceId, term);
      }

      if (concepts.length > 0) {
        await this.memoryRepo.addFocusArea(workspaceId, concepts[0]);
      }

      logger.info('Workspace interaction recorded', {
        workspaceId,
        conceptsExtracted: allConcepts.length,
      });
    } catch (err) {
      logger.warn('Failed to record workspace interaction', {
        workspaceId,
        error: err.message,
      });
    }
  }

  async getMemoryContext(workspaceId) {
    const memory = await this.memoryRepo.getOrCreate(workspaceId);

    const focusAreas = memory.focusAreas || [];
    const weakAreas = memory.weakAreas || [];
    const frequentConcepts = (memory.frequentConcepts || [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      focusAreas,
      weakAreas,
      frequentConcepts,
      learningPatterns: memory.learningPatterns || {},
      recentRevisions: (memory.revisionHistory || []).slice(-5),
    };
  }

  async detectWeakArea(workspaceId, query, hadLowConfidence) {
    if (!hadLowConfidence) return;

    const concepts = this.extractConcepts(query);
    for (const concept of concepts.slice(0, 3)) {
      await this.memoryRepo.addWeakArea(workspaceId, concept);
    }

    logger.info('Weak area detected', { workspaceId, concepts: concepts.slice(0, 3) });
  }

  async getRevisionSuggestions(workspaceId) {
    const memory = await this.memoryRepo.getOrCreate(workspaceId);
    const history = memory.revisionHistory || [];
    const concepts = memory.frequentConcepts || [];

    const now = Date.now();
    const staleThreshold = 3 * 24 * 60 * 60 * 1000; // 3 days

    // Find concepts not recently revisited
    const revisitedRecently = new Set(
      history
        .filter((r) => now - new Date(r.timestamp).getTime() < staleThreshold)
        .map((r) => r.topic),
    );

    const suggestions = concepts
      .filter((c) => !revisitedRecently.has(c.term))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({
        topic: c.term,
        frequency: c.count,
        lastSeen: c.lastSeen,
        reason: 'Not revisited recently',
      }));

    // Add weak areas that haven't been addressed
    const weakAreas = (memory.weakAreas || [])
      .filter((area) => !revisitedRecently.has(area))
      .slice(0, 3)
      .map((area) => ({
        topic: area,
        frequency: 0,
        lastSeen: null,
        reason: 'Previously identified weak area',
      }));

    return [...suggestions, ...weakAreas];
  }

  async getAdaptivePromptContext(workspaceId) {
    const memory = await this.getMemoryContext(workspaceId);

    const parts = [];

    if (memory.focusAreas.length > 0) {
      parts.push(
        `The user frequently focuses on: ${memory.focusAreas.slice(0, 5).join(', ')}.`,
      );
    }

    if (memory.weakAreas.length > 0) {
      parts.push(
        `The user has shown difficulty with: ${memory.weakAreas.slice(0, 3).join(', ')}. Provide extra clarity on these topics.`,
      );
    }

    if (memory.frequentConcepts.length > 0) {
      const topConcepts = memory.frequentConcepts.slice(0, 5).map((c) => c.term);
      parts.push(
        `Key concepts the user has been exploring: ${topConcepts.join(', ')}.`,
      );
    }

    return parts.length > 0
      ? `\n\nUser Learning Profile:\n${parts.join('\n')}`
      : '';
  }

  extractConcepts(text) {
    if (!text) return [];

    // Extract multi-word noun phrases and technical terms
    const cleaned = text
      .replace(/[?!.,;:'"()\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const words = cleaned.split(' ').filter((w) => w.length > 2);

    // Filter out common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'they',
      'that', 'this', 'with', 'from', 'what', 'how', 'when', 'where', 'why',
      'which', 'about', 'into', 'does', 'will', 'would', 'could', 'should',
      'tell', 'explain', 'describe', 'please', 'help', 'want', 'need',
      'know', 'understand', 'more', 'also', 'just', 'like', 'than',
    ]);

    const meaningful = words.filter((w) => !stopWords.has(w));

    // Extract bigrams for multi-word concepts
    const bigrams = [];
    for (let i = 0; i < meaningful.length - 1; i++) {
      bigrams.push(`${meaningful[i]} ${meaningful[i + 1]}`);
    }

    // Combine unique terms (prefer bigrams, add remaining unigrams)
    const concepts = [...new Set([...bigrams.slice(0, 3), ...meaningful.slice(0, 5)])];

    return concepts.slice(0, 8);
  }

  async logRevision(workspaceId, topic, confidence) {
    await this.memoryRepo.logRevision(workspaceId, topic, confidence);
  }
}

export default WorkspaceMemoryService;
