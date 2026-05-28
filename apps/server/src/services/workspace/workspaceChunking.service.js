import config from '../../config/env.js';
import logger from '../../loggers/logger.js';

class WorkspaceChunkingService {
  constructor() {
    // Target 500-900 tokens for semantic blocks
    this.targetChunkSizeTokens = 700; 
    this.minChunkSizeTokens = 450;
    this.maxChunkSizeTokens = 900;
    this.overlapTokens = 80;
    this.microChunkSizeTokens = 150;
    this.microOverlapTokens = 40;
  }

  scorePriorityTier(text) {
    const lower = text.toLowerCase();
    
    // Tier 1: headings, definitions, concept explanations, summaries
    const hasDefinition = /\b(?:is defined as|means|refers to|is the process of|is a type of|specifically is)\b/i.test(lower);
    const hasSummary = /\b(?:in summary|in conclusion|to sum up|to conclude|recap|key takeaway|overall)\b/i.test(lower);
    const hasHeading = /^(?:chapter|section|heading|introduction|summary|conclusion|overview)\b/i.test(lower);
    
    if (hasDefinition || hasSummary || hasHeading || lower.includes('definition:')) {
      return 1;
    }

    // Tier 2: examples, walkthroughs, supporting details, code blocks
    const hasExample = /\b(?:for example|such as|for instance|e\.g\.|like when|illustrate)\b/i.test(lower);
    const hasCode = /(?:const|let|var|function|import|class|return|\{|\})/i.test(lower);
    
    if (hasExample || hasCode) {
      return 2;
    }

    // Tier 3: filler, repetition, conversational noise
    return 3;
  }

  generateMicroChunks(parentChunk) {
    const sentences = this.splitSentences(parentChunk.text);
    const microChunks = [];
    let currentText = '';
    let currentTokens = 0;
    let sentencesInMicro = [];
    let microIndex = 0;

    for (const sentence of sentences) {
      const tokens = this.estimateTokens(sentence);

      if (currentTokens + tokens > this.microChunkSizeTokens && currentTokens > 0) {
        const text = sentencesInMicro.join(' ').trim();
        microChunks.push({
          chunkIndex: `${parentChunk.chunkIndex}_m_${microIndex++}`,
          parentChunkIndex: parentChunk.chunkIndex,
          chunkType: 'micro',
          text,
          startTime: parentChunk.startTime,
          endTime: parentChunk.endTime,
          pageNumber: parentChunk.pageNumber,
          sectionTitle: parentChunk.sectionTitle,
          tokenCount: currentTokens,
          priorityTier: parentChunk.priorityTier,
        });

        // Sliding window overlap
        const overlapCount = Math.max(1, Math.floor(sentencesInMicro.length / 3));
        sentencesInMicro = sentencesInMicro.slice(-overlapCount);
        currentTokens = sentencesInMicro.reduce((sum, s) => sum + this.estimateTokens(s), 0);
      }

      sentencesInMicro.push(sentence);
      currentTokens += tokens;
    }

    if (sentencesInMicro.length > 0) {
      microChunks.push({
        chunkIndex: `${parentChunk.chunkIndex}_m_${microIndex}`,
        parentChunkIndex: parentChunk.chunkIndex,
        chunkType: 'micro',
        text: sentencesInMicro.join(' ').trim(),
        startTime: parentChunk.startTime,
        endTime: parentChunk.endTime,
        pageNumber: parentChunk.pageNumber,
        sectionTitle: parentChunk.sectionTitle,
        tokenCount: currentTokens,
        priorityTier: parentChunk.priorityTier,
      });
    }

    return microChunks;
  }

  chunkTranscript(segments, opts = {}) {
    if (!segments?.length) return [];

    const semanticChunks = [];
    let currentChunk = { 
      text: '', 
      startTime: segments[0].start, 
      endTime: 0, 
      tokens: 0, 
      sentences: [],
      topicTitle: 'Discussion'
    };

    for (const segment of segments) {
      const sentences = this.splitSentences(segment.text);

      for (const sentence of sentences) {
        const sentenceTokens = this.estimateTokens(sentence);

        // Adaptive chunk boundary check: split when size fits target range
        const wouldExceedMax = currentChunk.tokens + sentenceTokens > this.maxChunkSizeTokens;
        const reachedTarget = currentChunk.tokens >= this.targetChunkSizeTokens;
        
        if ((wouldExceedMax || reachedTarget) && currentChunk.tokens >= this.minChunkSizeTokens) {
          // Finalize current semantic chunk
          currentChunk.text = currentChunk.sentences.join(' ').trim();
          currentChunk.endTime = segment.end || segment.start;
          
          const built = this.buildChunk(currentChunk, semanticChunks.length);
          built.chunkType = 'semantic';
          built.priorityTier = this.scorePriorityTier(built.text);
          semanticChunks.push(built);

          // Overlap setup
          const overlapSentences = this.getOverlapSentences(currentChunk.sentences, this.overlapTokens);
          currentChunk = {
            text: '',
            startTime: segment.start,
            endTime: 0,
            tokens: overlapSentences.reduce((sum, s) => sum + this.estimateTokens(s), 0),
            sentences: [...overlapSentences],
            topicTitle: segment.structureType === 'topic_start' ? segment.text : 'Discussion'
          };
        }

        currentChunk.sentences.push(sentence);
        currentChunk.tokens += sentenceTokens;
        currentChunk.endTime = segment.end || segment.start;
      }
    }

    // Final chunk
    if (currentChunk.sentences.length > 0) {
      currentChunk.text = currentChunk.sentences.join(' ').trim();
      const built = this.buildChunk(currentChunk, semanticChunks.length);
      built.chunkType = 'semantic';
      built.priorityTier = this.scorePriorityTier(built.text);
      semanticChunks.push(built);
    }

    // Generate hierarchical micro-chunks
    const allChunks = [];
    for (const semChunk of semanticChunks) {
      allChunks.push(semChunk);
      const micro = this.generateMicroChunks(semChunk);
      allChunks.push(...micro);
    }

    logger.info('Transcript chunked hierarchically', { 
      segments: segments.length, 
      semanticChunksCount: semanticChunks.length, 
      totalIncludingMicro: allChunks.length 
    });

    return allChunks;
  }

  chunkDocument(text, pageBreaks = [], opts = {}) {
    if (!text?.trim()) return [];

    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
    const semanticChunks = [];
    let currentChunk = { 
      text: '', 
      pageNumber: 1, 
      tokens: 0, 
      sentences: [], 
      sectionTitle: null 
    };

    for (const paragraph of paragraphs) {
      const heading = this.detectHeading(paragraph);
      const sentences = this.splitSentences(paragraph);
      const pageNumber = this.getPageNumber(paragraph, pageBreaks, text);

      if (heading && currentChunk.tokens > 50) {
        currentChunk.text = currentChunk.sentences.join(' ').trim();
        const built = this.buildDocumentChunk(currentChunk, semanticChunks.length);
        built.chunkType = 'semantic';
        built.priorityTier = this.scorePriorityTier(built.text);
        semanticChunks.push(built);

        currentChunk = {
          text: '',
          pageNumber,
          tokens: 0,
          sentences: [],
          sectionTitle: heading,
        };
      }

      for (const sentence of sentences) {
        const sentenceTokens = this.estimateTokens(sentence);
        
        const wouldExceedMax = currentChunk.tokens + sentenceTokens > this.maxChunkSizeTokens;
        const reachedTarget = currentChunk.tokens >= this.targetChunkSizeTokens;

        if ((wouldExceedMax || reachedTarget) && currentChunk.tokens >= this.minChunkSizeTokens) {
          currentChunk.text = currentChunk.sentences.join(' ').trim();
          const built = this.buildDocumentChunk(currentChunk, semanticChunks.length);
          built.chunkType = 'semantic';
          built.priorityTier = this.scorePriorityTier(built.text);
          semanticChunks.push(built);

          const overlapSentences = this.getOverlapSentences(currentChunk.sentences, this.overlapTokens);
          currentChunk = {
            text: '',
            pageNumber,
            tokens: overlapSentences.reduce((sum, s) => sum + this.estimateTokens(s), 0),
            sentences: [...overlapSentences],
            sectionTitle: currentChunk.sectionTitle,
          };
        }

        currentChunk.sentences.push(sentence);
        currentChunk.tokens += sentenceTokens;
        currentChunk.pageNumber = pageNumber;
      }
    }

    if (currentChunk.sentences.length > 0) {
      currentChunk.text = currentChunk.sentences.join(' ').trim();
      const built = this.buildDocumentChunk(currentChunk, semanticChunks.length);
      built.chunkType = 'semantic';
      built.priorityTier = this.scorePriorityTier(built.text);
      semanticChunks.push(built);
    }

    // Generate micro-chunks
    const allChunks = [];
    for (const semChunk of semanticChunks) {
      allChunks.push(semChunk);
      const micro = this.generateMicroChunks(semChunk);
      allChunks.push(...micro);
    }

    logger.info('Document chunked hierarchically', { 
      paragraphs: paragraphs.length, 
      semanticChunksCount: semanticChunks.length, 
      totalIncludingMicro: allChunks.length 
    });

    return allChunks;
  }

  chunkText(text, opts = {}) {
    return this.chunkDocument(text, [], opts);
  }

  buildChunk(data, index) {
    return {
      chunkIndex: index,
      text: data.text,
      startTime: data.startTime,
      endTime: data.endTime,
      pageNumber: null,
      sectionTitle: data.topicTitle || null,
      tokenCount: this.estimateTokens(data.text),
    };
  }

  buildDocumentChunk(data, index) {
    return {
      chunkIndex: index,
      text: data.text,
      startTime: null,
      endTime: null,
      pageNumber: data.pageNumber || null,
      sectionTitle: data.sectionTitle || null,
      tokenCount: this.estimateTokens(data.text),
    };
  }

  splitSentences(text) {
    if (!text?.trim()) return [];
    const raw = text
      .replace(/([.!?])\s+(?=[A-Z])/g, '$1|||')
      .replace(/([.!?])$/g, '$1|||')
      .split('|||')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return raw;
  }

  detectHeading(paragraph) {
    const trimmed = paragraph.trim();
    if (!trimmed) return null;
    const mdMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (mdMatch) return mdMatch[1].trim();
    if (/^[A-Z\s]{8,}$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) {
      return trimmed;
    }
    const numberedMatch = trimmed.match(/^(?:Chapter\s+)?\d+[.:]\s*(.+)$/i);
    if (numberedMatch && trimmed.length < 80) {
      return numberedMatch[1].trim();
    }
    if (trimmed.length < 60 && !trimmed.endsWith('.') && /^[A-Z]/.test(trimmed)) {
      const words = trimmed.split(/\s+/);
      if (words.length <= 8) return trimmed;
    }
    return null;
  }

  getPageNumber(paragraph, pageBreaks, fullText) {
    if (!pageBreaks?.length) return 1;
    const position = fullText.indexOf(paragraph);
    if (position < 0) return 1;
    let page = 1;
    for (const breakPos of pageBreaks) {
      if (position >= breakPos) page++;
      else break;
    }
    return page;
  }

  getOverlapSentences(sentences, targetOverlapTokens) {
    const overlap = [];
    let tokens = 0;
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceTokens = this.estimateTokens(sentences[i]);
      if (tokens + sentenceTokens > targetOverlapTokens) break;
      overlap.unshift(sentences[i]);
      tokens += sentenceTokens;
    }
    return overlap;
  }

  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}

export default WorkspaceChunkingService;
