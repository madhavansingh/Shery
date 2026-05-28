import logger from '../../loggers/logger.js';

class TopicExtractionService {
  constructor({ geminiFlash }) {
    this.geminiFlash = geminiFlash;
  }

  async extractTopics(chunks, sourceTitle) {
    if (!chunks || chunks.length === 0) return [];

    try {
      const chunkCount = chunks.length;
      // Target chapter count: ~1 chapter per 10 chunks, min 2 max 8
      const targetCount = Math.max(2, Math.min(8, Math.round(chunkCount / 10)));

      // Step 1: Sample chunks to fit within AI prompt budget
      const step = Math.max(1, Math.ceil(chunks.length / 50));
      const sampled = chunks.filter((_, i) => i % step === 0).slice(0, 50);

      const contextText = sampled
        .map((c) => `[Chunk ${c.chunkIndex}] ${c.text || ''}`)
        .join('\n\n');

      const prompt = `You are a principal-level technical curriculum architect and expert semantic knowledge engineer.
Your task is to analyze the following source material chunks from a document or video titled "${sourceTitle}" and segment it into exactly ${targetCount} sequential, semantic topic sections.

SOURCE CHUNKS EXCERPT:
${contextText}

TASK: Segment this document/video into exactly ${targetCount} topic sections. Return a valid JSON array of objects representing these sections.

CRITICAL RULES — YOU MUST STRICTLY FOLLOW THESE DIRECTIVES:
❌ ZERO GENERIC LABELS OR ORDINAL PLACEHOLDERS: Absolutely NO "Part 1", "Section A", "Overview", "Introduction", "Summary", "Topic 2", or numeric prefixes.
❌ NO GENERIC SUMMARIES: Do not start summaries with "overview of", "introduction to", "in this section", "this chunk covers".
✅ CONCEPT-FIRST NAMING: Every topic segment title MUST specifically name the core technical concepts, software libraries, methodologies, or theories being discussed (e.g. "Reciprocal Rank Fusion", "Cosine Similarity Vectors", "Sentence Boundary Chunking").
✅ CONTINUOUS RANGE: The startChunkIndex of the first segment MUST be 0. The endChunkIndex of each segment must match the start of the next segment - 1. The last segment's endChunkIndex must be ${chunkCount - 1}.

Return exactly this structural JSON format:
[
  {
    "title": "Specific Concept Name (2-5 words, premium textbook-grade)",
    "startChunkIndex": 0,
    "endChunkIndex": 4,
    "summary": "One precise, active sentence explaining what technical skill or concept the viewer/reader will master in this section (max 15 words).",
    "keywords": ["concept1", "concept2", "concept3"]
  }
]

Return ONLY valid JSON. No markdown formatting, no backticks, no preamble, no comment.`;

      let segments = [];

      if (this.geminiFlash) {
        const result = await this.geminiFlash.generateContent(prompt);
        const text = result.response?.text() || '';
        const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              segments = parsed.map((s) => {
                const nearestChunk = chunks[s.startChunkIndex] || chunks[0];
                const cleanTitle = purgeGenericIdentifiers(s.title, nearestChunk?.text || '');
                return {
                  title: cleanTitle,
                  startChunkIndex: typeof s.startChunkIndex === 'number' ? s.startChunkIndex : 0,
                  endChunkIndex: typeof s.endChunkIndex === 'number' ? s.endChunkIndex : chunkCount - 1,
                  summary: sanitizeSummary(s.summary, cleanTitle),
                  keywords: sanitizeKeywords(s.keywords, cleanTitle),
                };
              });
            }
          } catch (jsonErr) {
            logger.warn('JSON parse failed in extractTopics, falling back to heuristic', { error: jsonErr.message });
          }
        }
      }

      // Dynamic fallback if AI failed or not present
      if (segments.length === 0) {
        const chunkStep = Math.max(1, Math.ceil(chunkCount / targetCount));
        for (let i = 0; i < chunkCount; i += chunkStep) {
          const start = i;
          const end = Math.min(i + chunkStep - 1, chunkCount - 1);
          const chunk = chunks[start];
          const text = chunk?.text || '';
          const derivedTitle = extractPhraseTitle(text) || `Key Concept ${Math.floor(i / chunkStep) + 1}`;
          
          segments.push({
            title: derivedTitle,
            startChunkIndex: start,
            endChunkIndex: end,
            summary: `Explores foundational insights regarding ${derivedTitle}.`,
            keywords: sanitizeKeywords([], text),
          });
        }
      }

      // Validate boundary ranges
      segments.sort((a, b) => a.startChunkIndex - b.startChunkIndex);
      segments[0].startChunkIndex = 0;
      for (let i = 1; i < segments.length; i++) {
        segments[i].startChunkIndex = segments[i - 1].endChunkIndex + 1;
      }
      segments[segments.length - 1].endChunkIndex = chunkCount - 1;

      return segments;
    } catch (err) {
      logger.error('Topic extraction failed completely, using basic fallback', { error: err.message });
      return [{
        title: 'Foundational Insights',
        startChunkIndex: 0,
        endChunkIndex: chunks.length - 1,
        summary: 'Opening analysis of the uploaded source.',
        keywords: []
      }];
    }
  }

  async extractConceptTags(text) {
    if (!text || !this.geminiFlash) return [];

    try {
      const prompt = `Analyze the following text and extract a flat list of the top 3-5 most specific, important technical or conceptual terms mentioned.
Each term should be a single noun phrase (1-3 words) representing a core concept, pattern, algorithm, library, or system.
Avoid generic words (like "introduction", "process", "code", "file").
Return ONLY a valid JSON array of strings.

TEXT:
${text.slice(0, 3000)}

Format: ["conceptName1", "conceptName2", ...]`;

      const result = await this.geminiFlash.generateContent(prompt);
      const resText = result.response?.text() || '';
      const jsonMatch = resText.trim().match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(c => String(c).trim()).filter(c => c.length > 2);
        }
      }
    } catch (err) {
      logger.warn('Failed to extract concept tags with AI, using heuristic', { error: err.message });
    }

    // Heuristic fallback
    return sanitizeKeywords([], text);
  }

  async generateDocumentIntelligence(text = '', rawTitle = '', type = 'pdf') {
    if (!text?.trim()) {
      return this._getDefaultDocumentIntelligence(rawTitle, type);
    }

    try {
      // Sample context to fit within prompt budget
      const cleanText = text.trim();
      const length = cleanText.length;
      let sample = '';
      if (length <= 7000) {
        sample = cleanText;
      } else {
        const first = cleanText.substring(0, 3000);
        const middle = cleanText.substring(Math.floor(length / 2) - 1000, Math.floor(length / 2) + 1000);
        const last = cleanText.substring(length - 2000);
        sample = `[DOCUMENT BEGINNING]\n${first}\n\n[DOCUMENT MIDDLE]\n${middle}\n\n[DOCUMENT END]\n${last}`;
      }

      const prompt = `You are a world-class AI learning scientist and curriculum research engineer.
Analyze the following source document (type: ${type}) titled "${rawTitle}" and extract a comprehensive, deep-reasoning semantic summary and learning metadata map.

SOURCE TEXT EXCERPT:
${sample}

TASK: Generate a rich, professional, textbook-grade document intelligence metadata map. Return ONLY a valid JSON object.

JSON STRUCTURE REQUIRED:
{
  "refinedTitle": "Refine the document title to be textbook-grade, removing extension tags or generic timestamps (e.g. 'Intro to RAG & LCEL Vector Stores')",
  "semanticSummary": "A highly descriptive, 2-3 sentence conceptual summary of the document's contents, core themes, and educational purpose (no intro phrases like 'this document covers')",
  "topicHierarchy": "A markdown outline representing the logical outline tree of the topics covered in this document (e.g., # Pillar 1\\n- Subtopic 1\\n- Subtopic 2)",
  "concepts": ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
  "domain": "Domain classification (e.g., Computer Science, Quantitative Finance, Clinical Pathology)",
  "technicalityScore": 85, // Integer from 0 to 100
  "difficulty": "Intermediate", // Beginner, Intermediate, Advanced, or Expert
  "educationalIntent": "Describe the educational intent (e.g., Practical Tutorial, Structural Reference, Theoretical Foundations)",
  "documentPurpose": "Core purpose or utility of the document",
  "keyTakeaways": [
    "takeaway 1",
    "takeaway 2",
    "takeaway 3"
  ],
  "learningObjectives": [
    "What the student will master 1",
    "What the student will master 2"
  ],
  "suggestedQuestions": [
    "Suggested question 1",
    "Suggested question 2",
    "Suggested question 3"
  ],
  "semanticRelationships": "Describe how this document conceptually links to general knowledge or prerequisites (e.g. 'Expands on Vector Database design, building on general data structures and indexing theory')"
}

Return ONLY valid JSON. No markdown backticks, no comment lines, no preamble.`;

      if (this.geminiFlash) {
        const result = await this.geminiFlash.generateContent(prompt);
        const resText = result.response?.text() || '';
        const jsonMatch = resText.trim().match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            refinedTitle: parsed.refinedTitle?.trim() || rawTitle,
            semanticSummary: parsed.semanticSummary?.trim() || `Analytical summary of ${rawTitle}.`,
            topicHierarchy: parsed.topicHierarchy?.trim() || `# ${rawTitle}\n- General Concepts`,
            concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 6) : [],
            domain: parsed.domain?.trim() || 'General Learning',
            technicalityScore: typeof parsed.technicalityScore === 'number' ? parsed.technicalityScore : 50,
            difficulty: ['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(parsed.difficulty) ? parsed.difficulty : 'Intermediate',
            educationalIntent: parsed.educationalIntent?.trim() || 'General Information',
            documentPurpose: parsed.documentPurpose?.trim() || 'Educational grounding reference',
            keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [`Foundational overview of ${rawTitle}`],
            learningObjectives: Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives : [`Master concepts detailed in ${rawTitle}`],
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 3) : [],
            semanticRelationships: parsed.semanticRelationships?.trim() || 'Linked to active learning space.',
          };
        }
      }
    } catch (err) {
      logger.warn('Failed to generate document intelligence with AI, using fallback', { error: err.message });
    }

    return this._getDefaultDocumentIntelligence(rawTitle, type);
  }

  _getDefaultDocumentIntelligence(rawTitle, type) {
    return {
      refinedTitle: rawTitle,
      semanticSummary: `Reference document detailing key elements of ${rawTitle}.`,
      topicHierarchy: `# ${rawTitle}\n- Introductory Concepts\n- Core Mechanics\n- Wrap-up Summary`,
      concepts: [rawTitle.substring(0, 20)],
      domain: 'General Studies',
      technicalityScore: 50,
      difficulty: 'Intermediate',
      educationalIntent: 'Grounding Reference',
      documentPurpose: 'Grounding material for conceptual chat analysis.',
      keyTakeaways: [`Understand the foundations of ${rawTitle}`],
      learningObjectives: [`Recall and explain main concepts inside ${rawTitle}`],
      suggestedQuestions: [
        `What are the main concepts covered in ${rawTitle}?`,
        `Can you summarize the core thesis of this document?`,
        `How does this relate to other topics?`
      ],
      semanticRelationships: 'Linked to active learning space.'
    };
  }
}

// ─── Programmatic Purging Helpers ─────────────────────────────────────────────

function purgeGenericIdentifiers(title = '', textContext = '') {
  let clean = title.trim();

  // 1. Remove ordinal and structural headers like "Part 1:", "Section B -"
  clean = clean.replace(/^(?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic|overview|intro|introduction)\s*\d+[\s\:\-\–\—\•\.\,\|]*/i, '');
  clean = clean.replace(/[\s\:\-\–\—\•\.\,\|]+(part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+$/i, '');
  clean = clean.replace(/\((?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+\)$/i, '');
  clean = clean.replace(/^\d+[\.\s\-]+/, '');

  clean = clean.trim();

  // 2. Fallback if the remaining title is too generic
  const lower = clean.toLowerCase();
  const genericTerms = ['overview', 'introduction', 'intro', 'concepts', 'discussion', 'details', 'setup', 'conclusion', 'summary', 'wrapup', 'qa', 'q&a', 'questions', 'general', 'main', 'segment', 'part', 'section'];

  if (!clean || clean.length < 3 || genericTerms.includes(lower)) {
    const derived = extractPhraseTitle(textContext);
    if (derived) {
      clean = derived;
    } else {
      clean = 'Foundational Concepts';
    }
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function sanitizeSummary(text, topic) {
  if (!text || typeof text !== 'string') return `Explores key concepts in ${topic}.`;
  const lower = text.toLowerCase();
  const bad = [
    'overview and concepts', 'overview of', 'concepts relating', 'introduction to',
    'in this section', 'this section covers', 'this chapter', 'an overview',
    'key concepts for', 'learn about the', 'discusses the',
  ];
  if (bad.some((b) => lower.includes(b))) return `Focuses on mastering ${topic}.`;
  return text.trim();
}

const GENERIC_KEYWORDS = new Set([
  'part', 'section', 'chapter', 'overview', 'video', 'lecture', 'topic',
  'introduction', 'concept', 'concepts', 'this', 'that', 'with', 'from',
  'some', 'more', 'about', 'learn', 'understand', 'explain', 'code', 'file'
]);

const TECHNICAL_KEYWORDS = new Set([
  'prompt', 'prompttemplate', 'template', 'chain', 'runnable', 'pipeline', 'lcel', 'langchain',
  'embedding', 'embeddings', 'vector', 'vectorstore', 'vector database', 'retrieval', 'rag', 'groq',
  'openai', 'model', 'llm', 'callback', 'stream', 'streaming', 'memory', 'buffer', 'output', 'parser',
  'css', 'flexbox', 'grid', 'responsive', 'breakpoint', 'theme', 'theming', 'animation', 'scroll',
  'react', 'hook', 'state', 'effect', 'context', 'props', 'component', 'render', 'vitest', 'testing',
  'database', 'firestore', 'firebase', 'supabase', 'cloud', 'storage', 'node', 'express', 'middleware',
  'rrf', 'bm25', 'qdrant', 'indexing', 'nlp', 'parsing', 'pdf', 'chunking', 'graph', 'prerequisite'
]);

function sanitizeKeywords(kws, fallbackText) {
  if (Array.isArray(kws) && kws.length > 0) {
    const clean = kws
      .map((k) => String(k).toLowerCase().trim())
      .filter((k) => k.length > 2 && !GENERIC_KEYWORDS.has(k));
    if (clean.length > 0) return clean.slice(0, 4);
  }
  return String(fallbackText || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !GENERIC_KEYWORDS.has(w.toLowerCase()))
    .slice(0, 4)
    .map((w) => w.toLowerCase());
}

function extractPhraseTitle(text) {
  if (!text) return null;

  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const foundTech = [];
  for (const word of words) {
    const lw = word.toLowerCase();
    if (TECHNICAL_KEYWORDS.has(lw) && !foundTech.includes(word)) {
      foundTech.push(word);
    }
  }

  if (foundTech.length >= 2) {
    const titleTech = foundTech.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' & ');
    return `Mastering ${titleTech}`;
  } else if (foundTech.length === 1) {
    const term = foundTech[0].charAt(0).toUpperCase() + foundTech[0].slice(1).toLowerCase();
    return `Configuring ${term}`;
  }

  const stopwords = new Set([
    'a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'and', 'or', 'but', 'we', 'so', 'that', 'this',
    'these', 'those', 'you', 'i', 'my', 'your', 'its', 'their', 'our', 'what', 'why', 'how', 'here',
    'there', 'about', 'some', 'more', 'all', 'any', 'get', 'make', 'do', 'go', 'with', 'from', 'okay',
    'then', 'well', 'now', 'so'
  ]);

  const cleanWords = words
    .filter((w) => !stopwords.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (cleanWords.length >= 2) {
    return cleanWords.slice(0, 3).join(' ');
  }

  return null;
}

export default TopicExtractionService;
