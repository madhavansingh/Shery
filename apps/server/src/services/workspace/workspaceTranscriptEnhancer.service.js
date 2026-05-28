import logger from '../../loggers/logger.js';

class WorkspaceTranscriptEnhancerService {
  constructor({ aiClient }) {
    this.aiClient = aiClient; // geminiFlash
  }

  /**
   * High-fidelity transcript semantic enhancement pipeline
   * @param {Array} segments   Raw segments [{ text, start, end }]
   * @returns {Promise<Array>} Enhanced segments
   */
  async enhanceTranscript(segments = []) {
    if (!segments.length) return [];
    
    // 1. Regex-based fast acoustic filler word cleanup
    const fillerCleaned = this.cleanupFillerWords(segments);

    // 2. Sentence-level overlapping duplicates cleanup
    const deduplicated = this.deduplicateSentences(fillerCleaned);

    // 3. AI-assisted grammar, punctuation, and structural capitalizations restoring
    const punctuated = await this.restorePunctuation(deduplicated);

    return punctuated;
  }

  /**
   * Fast cleanup of acoustic speech filler words
   */
  cleanupFillerWords(segments = []) {
    const fillerRegex = /\b(um|uh|like|you know|sort of|kind of|i mean|so basically)\b/gi;
    
    return segments.map(seg => {
      let cleanedText = seg.text
        .replace(fillerRegex, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return {
        ...seg,
        text: cleanedText || seg.text // fallback to original if completely stripped
      };
    });
  }

  /**
   * Deduplicates repeating/stuttering acoustic sentence fragments
   */
  deduplicateSentences(segments = []) {
    if (segments.length < 2) return segments;

    const deduplicated = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const prev = deduplicated[deduplicated.length - 1];
      const curr = segments[i];

      const prevWords = prev.text.toLowerCase().split(/\s+/);
      const currWords = curr.text.toLowerCase().split(/\s+/);

      // If text blocks have exact match or extremely high word overlap, merge them
      const areHighlySimilar = this._calculateWordOverlapRatio(prevWords, currWords) > 0.85;

      if (areHighlySimilar) {
        // Merge timings rather than duplicating the segment
        prev.end = Math.max(prev.end, curr.end);
        logger.debug('Merged stuttering duplicate segments', { prevText: prev.text, currText: curr.text });
      } else {
        deduplicated.push(curr);
      }
    }

    return deduplicated;
  }

  /**
   * Restores complex punctuation using Gemini with structural index mapping
   */
  async restorePunctuation(segments = []) {
    if (!this.aiClient || segments.length === 0) return segments;

    try {
      logger.info('Restoring punctuation across transcript segments using Gemini...', { count: segments.length });

      // Group segments into batches of 20 to prevent LLM context overflows and keep fast responses
      const batchSize = 25;
      const punctuatedSegments = [];

      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        
        // Construct index-mapped prompt: [0] segment text [1] segment text
        const promptLines = batch.map((seg, idx) => `[${idx}] ${seg.text}`);
        const prompt = `You are a professional transcript editor. Capitalize, punctuate, and fix grammar errors for the transcript segments listed below.
IMPORTANT RULES:
1. Maintain the exact line-by-line index formatting: e.g. "[idx] Punctuated and cleaned line."
2. Do not merge, delete, or skip indices.
3. Keep the meaning exactly identical; do not rewrite or add comments.

TRANSCRIPT:
${promptLines.join('\n')}`;

        const response = await this.aiClient.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 }
        });

        const reply = response.response?.text?.() || '';
        const parsedMap = this._parseIndexedOutput(reply);

        // Apply punctuated text back to original segments
        batch.forEach((seg, idx) => {
          const enhancedText = parsedMap[idx];
          punctuatedSegments.push({
            ...seg,
            text: enhancedText && enhancedText.length > 5 ? enhancedText : seg.text
          });
        });
      }

      return punctuatedSegments;
    } catch (err) {
      logger.error('Gemini transcript punctuation restoration failed, falling back to clean text', { error: err.message });
      return segments;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helper utilities
  // ---------------------------------------------------------------------------

  _calculateWordOverlapRatio(wordsA, wordsB) {
    if (!wordsA.length || !wordsB.length) return 0;
    const setA = new Set(wordsA);
    let intersection = 0;
    wordsB.forEach(w => {
      if (setA.has(w)) intersection++;
    });
    return intersection / Math.min(wordsA.length, wordsB.length);
  }

  _parseIndexedOutput(text) {
    const map = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Matches pattern: [0] Some punctuated text
      const match = line.trim().match(/^\[(\d+)\]\s*(.+)$/);
      if (match) {
        const index = parseInt(match[1], 10);
        const content = match[2].trim();
        map[index] = content;
      }
    }
    return map;
  }
}

export default WorkspaceTranscriptEnhancerService;
