import logger from '../../loggers/logger.js';

class TranscriptPostProcessorService {
  constructor({ geminiFlash } = {}) {
    this.geminiFlash = geminiFlash;
    this.fillerWords = [
      /\bum\b/gi,
      /\buh\b/gi,
      /\blike\b/gi,
      /\byou\s+know\b/gi,
      /\bbasically\b/gi,
      /\bactually\b/gi,
      /\bi\s+mean\b/gi,
      /\bsort\s+of\b/gi,
      /\bkind\s+of\b/gi,
      /\boh\b/gi,
      /\bso\s+anyway\b/gi,
      /\bright\b/gi,
    ];
  }

  async process(rawSegments, opts = {}) {
    if (!rawSegments || rawSegments.length === 0) return [];

    try {
      logger.info('Starting transcript post-processing', { segmentCount: rawSegments.length });
      
      // Step 1: Remove filler words and deduplicate repeated phrases locally
      let cleanedSegments = rawSegments.map(segment => {
        let cleanedText = segment.text || '';
        for (const fillerRegex of this.fillerWords) {
          cleanedText = cleanedText.replace(fillerRegex, '');
        }
        // Remove double spaces and clean stutters (e.g. "the the" -> "the")
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        cleanedText = this.deduplicateWords(cleanedText);
        
        return {
          ...segment,
          text: cleanedText
        };
      }).filter(s => s.text.length > 0);

      // Step 2: Restore paragraphs and detect topic boundaries
      cleanedSegments = this.restoreParagraphsAndBoundaries(cleanedSegments);

      // Step 3: Local structural detection (definitions, code, lists, examples)
      cleanedSegments = this.detectStructureLocally(cleanedSegments);

      // Step 4: If AI enhancement is requested and geminiFlash is available, perform final polish
      if (this.geminiFlash && opts.useAI === true) {
        cleanedSegments = await this.restorePunctuationWithAI(cleanedSegments);
      } else {
        // Fallback: simple punctuation heuristic
        cleanedSegments = this.basicPunctuationCleanup(cleanedSegments);
      }

      logger.info('Transcript post-processing completed', { originalCount: rawSegments.length, finalCount: cleanedSegments.length });
      return cleanedSegments;
    } catch (error) {
      logger.error('Error during transcript post-processing, returning basic cleaned segments', { error: error.message });
      return this.basicPunctuationCleanup(rawSegments);
    }
  }

  deduplicateWords(text) {
    // Remove immediate word stutters (e.g., "we we will" -> "we will")
    return text.replace(/\b(\w+)\s+\1\b/gi, '$1');
  }

  restoreParagraphsAndBoundaries(segments) {
    const processed = [];
    let currentParagraph = [];
    const topicKeywords = [
      'firstly', 'secondly', 'finally', 'now let\'s', 'moving on', 'next',
      'in conclusion', 'to sum up', 'for example', 'let\'s start', 'today we will'
    ];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const prevSeg = segments[i - 1];
      const text = seg.text.trim();

      // Detect paragraph/topic boundary based on pause (>3 seconds) or transition keywords
      const isPause = prevSeg ? (seg.start - prevSeg.end > 3.0) : false;
      const startsWithKeyword = topicKeywords.some(kw => text.toLowerCase().startsWith(kw));

      if ((isPause || startsWithKeyword) && currentParagraph.length > 0) {
        // Finalize current paragraph
        processed.push(...this.markParagraph(currentParagraph));
        currentParagraph = [];
      }

      currentParagraph.push(seg);
    }

    if (currentParagraph.length > 0) {
      processed.push(...this.markParagraph(currentParagraph));
    }

    return processed;
  }

  markParagraph(segments) {
    return segments.map((seg, idx) => ({
      ...seg,
      isParagraphStart: idx === 0,
    }));
  }

  detectStructureLocally(segments) {
    return segments.map(seg => {
      const text = seg.text;
      const tags = [];
      let structureType = 'narrative';

      // 1. Definition detection
      const defRegex = /\b([\w\s]{2,30})\s+(?:is defined as|means|is the process of|refers to|is a type of)\s+([^.]+)/i;
      if (defRegex.test(text)) {
        tags.push('definition');
        structureType = 'definition';
      }

      // 2. Code block detection
      const codeRegex = /(?:const|let|var|function|import|class|return|\{|\}|\[\]|=>|console\.log|public\s+class)/i;
      if (codeRegex.test(text) && (text.includes('(') || text.includes('='))) {
        tags.push('code');
        structureType = 'code';
      }

      // 3. List detection
      const listRegex = /^(?:\d+[.)]|\*|-|\+)\s+/i;
      if (listRegex.test(text) || text.includes('firstly') || text.includes('secondly') || text.includes('list of')) {
        tags.push('list');
        structureType = 'list';
      }

      // 4. Example detection
      if (/\b(?:for example|e\.g\.|such as|for instance|like when)\b/i.test(text)) {
        tags.push('example');
        structureType = 'example';
      }

      return {
        ...seg,
        structureType,
        conceptTags: tags,
      };
    });
  }

  basicPunctuationCleanup(segments) {
    return segments.map(segment => {
      let text = segment.text.trim();
      if (!text) return segment;

      // Capitalize first letter
      text = text.charAt(0).toUpperCase() + text.slice(1);
      
      // Add period if no punctuation at end
      if (!/[.!?]$/.test(text)) {
        text += '.';
      }

      return {
        ...segment,
        text
      };
    });
  }

  async restorePunctuationWithAI(segments) {
    const batchSize = 50;
    const processedSegments = [];

    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = segments.slice(i, i + batchSize);
      const combinedText = batch.map((s, idx) => `[SEG_${idx}] ${s.text}`).join('\n');

      const systemInstruction = 
        "You are an elite transcript post-processing editor. Your task is to restore punctuation, capitalize proper nouns, fix broken sentences, and repair grammar in the provided transcript segments. " +
        "CRITICAL RULES:\n" +
        "1. Maintain the EXACT structure and line mappings. For every segment labeled [SEG_X], output exactly one [SEG_X] line with the polished text.\n" +
        "2. Do NOT summarize or omit any content.\n" +
        "3. Remove filler words (um, uh, like, basically) if they disrupt the flow, but keep all informational words.\n" +
        "4. Output ONLY the processed segments in the format '[SEG_X] Polished text' separated by newlines.";

      try {
        const response = await this.geminiFlash.generateContent({
          contents: [
            { role: 'user', parts: [{ text: `${systemInstruction}\n\nTranscript segments:\n${combinedText}` }] }
          ]
        });

        const resultText = response.response?.text() || '';
        const lines = resultText.split('\n').map(l => l.trim()).filter(Boolean);
        
        const polishedMap = new Map();
        for (const line of lines) {
          const match = line.match(/^\[SEG_(\d+)\]\s*(.+)$/i);
          if (match) {
            polishedMap.set(parseInt(match[1], 10), match[2].trim());
          }
        }

        batch.forEach((segment, idx) => {
          const polishedText = polishedMap.get(idx);
          processedSegments.push({
            ...segment,
            text: polishedText || segment.text,
          });
        });
      } catch (err) {
        logger.warn('Failed AI punctuation batch, falling back to basic cleanup for batch', { index: i, error: err.message });
        batch.forEach(segment => {
          processedSegments.push(this.basicPunctuationCleanup([segment])[0]);
        });
      }
    }

    return processedSegments;
  }
}

export default TranscriptPostProcessorService;

