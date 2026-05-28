import logger from '../../loggers/logger.js';

class RetrievalEvaluationService {
  constructor() {
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'by', 'from',
      'in', 'to', 'of', 'with', 'about', 'against', 'between', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
      'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
    ]);
  }

  /**
   * Evaluate a RAG response against retrieved chunks and the user query
   * @param {string} query 
   * @param {string} responseText 
   * @param {Array} chunks 
   * @returns {Object} Evaluation report
   */
  evaluateRetrieval(query, responseText, chunks = []) {
    const startMs = Date.now();

    if (!responseText || !chunks.length) {
      return {
        groundingScore: 0,
        hallucinationRisk: 1.0,
        citationAccuracy: 0,
        precision: 0,
        coverage: 0,
        confidenceLabel: 'Low',
        warnings: ['No grounding context or response text provided.'],
        metrics: {
          groundedStatements: 0,
          totalStatements: 0,
          citationMatchesCount: 0,
          evaluatedChunksCount: chunks.length
        }
      };
    }

    // 1. Break response text into semantic statements (sentences)
    const statements = responseText
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 15); // filter out very short fragments

    if (statements.length === 0) {
      return {
        groundingScore: 1.0,
        hallucinationRisk: 0.0,
        citationAccuracy: 1.0,
        precision: 1.0,
        confidenceLabel: 'High',
        warnings: [],
        metrics: { groundedStatements: 0, totalStatements: 0, citationMatchesCount: 0, evaluatedChunksCount: chunks.length }
      };
    }

    let groundedCount = 0;
    const statementsReport = [];
    const chunkTexts = chunks.map(c => c.text.toLowerCase());

    // 2. Compute statement-by-statement grounding score
    for (const statement of statements) {
      const stmtLower = statement.toLowerCase();
      let maxOverlap = 0;
      let primarySourceId = null;
      let primarySourceTitle = null;

      for (const chunk of chunks) {
        const overlap = this._calculateOverlap(stmtLower, chunk.text.toLowerCase());
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          primarySourceId = chunk.sourceId;
          primarySourceTitle = chunk.sourceTitle;
        }
      }

      // If overlap exceeds 0.25 (meaning substantial key terms are grounded in a chunk)
      const isGrounded = maxOverlap >= 0.25;
      if (isGrounded) groundedCount++;

      statementsReport.push({
        statement,
        grounded: isGrounded,
        maxOverlapScore: Math.round(maxOverlap * 100) / 100,
        sourceTitle: primarySourceTitle || 'None'
      });
    }

    const groundingScore = groundedCount / statements.length;
    const hallucinationRisk = 1.0 - groundingScore;

    // 3. Compute citation accuracy (checking inline citations vs active chunks)
    // Matches patterns like [Source Title], [1], (12:42), [Page X]
    const citationRegex = /\[([^\]]+)\]|\(([0-9]{1,2}:[0-9]{2})\)|Page\s+([0-9]+)/gi;
    let citationMatchesCount = 0;
    let validCitationMatchesCount = 0;
    let match;

    while ((match = citationRegex.exec(responseText)) !== null) {
      citationMatchesCount++;
      const [fullMatch, bracketSource, timeStr, pageStr] = match;

      let citationValid = false;

      // Check if bracket source matches one of the chunk source titles
      if (bracketSource) {
        const sourceLower = bracketSource.toLowerCase();
        citationValid = chunks.some(c => 
          c.sourceTitle.toLowerCase().includes(sourceLower) || 
          sourceLower.includes(c.sourceTitle.toLowerCase())
        );
      }
      // Check timestamp citations
      else if (timeStr) {
        const citationSeconds = this._timeToSeconds(timeStr);
        citationValid = chunks.some(c => 
          c.startTime !== null && 
          c.endTime !== null && 
          citationSeconds >= (c.startTime - 10) && 
          citationSeconds <= (c.endTime + 10)
        );
      }
      // Check page citations
      else if (pageStr) {
        const citationPage = parseInt(pageStr, 10);
        citationValid = chunks.some(c => c.pageNumber === citationPage);
      }

      if (citationValid) {
        validCitationMatchesCount++;
      }
    }

    const citationAccuracy = citationMatchesCount > 0 
      ? (validCitationMatchesCount / citationMatchesCount) 
      : 1.0; // default to 100% if no citations were generated but sources are fine

    // 4. Compute precision & semantic coverage of key query terms
    const queryTerms = this._tokenize(query);
    const textTerms = this._tokenize(responseText);
    let matchedQueryTerms = 0;

    for (const term of queryTerms) {
      if (textTerms.has(term)) matchedQueryTerms++;
    }
    const semanticCoverage = queryTerms.size > 0 ? (matchedQueryTerms / queryTerms.size) : 1.0;

    // Precision represents how tightly the retrieved source facts map to the final text
    const chunksUsed = new Set();
    statementsReport.forEach(r => {
      if (r.grounded && r.sourceTitle !== 'None') chunksUsed.add(r.sourceTitle);
    });
    const uniqueChunksRetrieved = new Set(chunks.map(c => c.sourceTitle));
    const precision = uniqueChunksRetrieved.size > 0 
      ? (chunksUsed.size / uniqueChunksRetrieved.size) 
      : 0.0;

    // 5. Calculate final confidence rating and generate ambient warning descriptions
    let scoreSum = (groundingScore * 0.5) + (citationAccuracy * 0.3) + (semanticCoverage * 0.2);
    let confidenceLabel = 'High';
    const warnings = [];

    if (scoreSum < 0.5) {
      confidenceLabel = 'Low';
    } else if (scoreSum < 0.8) {
      confidenceLabel = 'Medium';
    }

    // Add smart actionable indicators
    if (hallucinationRisk > 0.4) {
      warnings.push('High risk of ungrounded responses. The AI might be generating answers from general knowledge rather than your specific sources.');
    }
    if (citationAccuracy < 0.6) {
      warnings.push('Weak citation alignment detected. Page/timestamp references might not map accurately to the retrieved contexts.');
    }
    if (semanticCoverage < 0.5) {
      warnings.push('Incomplete coverage of prompt concepts. Some aspects of your request could not be fully grounded in the uploaded sources.');
    }
    if (chunks.length < 3) {
      warnings.push('Low retrieval depth. Upload additional documents covering this topic for higher-precision grounding.');
    }

    logger.info('Retrieval evaluation complete', {
      query: query.substring(0, 50),
      confidence: confidenceLabel,
      groundingScore: Math.round(groundingScore * 100) / 100,
      hallucinationRisk: Math.round(hallucinationRisk * 100) / 100,
      citationAccuracy: Math.round(citationAccuracy * 100) / 100,
      durationMs: Date.now() - startMs
    });

    return {
      groundingScore: Math.round(groundingScore * 100) / 100,
      hallucinationRisk: Math.round(hallucinationRisk * 100) / 100,
      citationAccuracy: Math.round(citationAccuracy * 100) / 100,
      precision: Math.round(precision * 100) / 100,
      coverage: Math.round(semanticCoverage * 100) / 100,
      confidenceLabel,
      warnings,
      statements: statementsReport.slice(0, 10), // Limit statement report
      metrics: {
        groundedStatements: groundedCount,
        totalStatements: statements.length,
        citationMatchesCount,
        evaluatedChunksCount: chunks.length
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Private helper utilities
  // ---------------------------------------------------------------------------

  _calculateOverlap(stmt, chunk) {
    const stmtSet = this._tokenize(stmt);
    const chunkSet = this._tokenize(chunk);

    if (stmtSet.size === 0) return 0;

    let overlapCount = 0;
    for (const token of stmtSet) {
      if (chunkSet.has(token)) {
        overlapCount++;
      }
    }

    // Jaccard similarity or simple ratio over statement size
    return overlapCount / Math.sqrt(stmtSet.size * chunkSet.size || 1);
  }

  _tokenize(text) {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2 && !this.stopWords.has(t))
    );
  }

  _timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
      return (parts[0] * 60) + parts[1];
    }
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
  }
}

export default RetrievalEvaluationService;
