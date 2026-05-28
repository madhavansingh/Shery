import logger from '../loggers/logger.js';

function fmt(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

class AiMetadataService {
  constructor(aiClient) {
    this.aiClient = aiClient;
  }

  async generateStarterQuestions(chunks, videoTitle) {
    const fallback = [
      `What is the main topic covered in "${videoTitle}"?`,
      'Can you summarize the key concepts explained?',
      'What are the most important points from this lecture?',
      'Are there any prerequisites I should know before watching this?',
      'What are practical applications of what was taught here?',
    ];

    try {
      const context = chunks
        .slice(0, 15)
        .map((chunk) => `[${chunk.startLabel}] ${chunk.text}`)
        .join('\n\n');

      const prompt = `You are an expert AI tutor analyzing a lecture video.

Video title: "${videoTitle}"

Transcript excerpt:
${context}

Generate exactly 5 specific, interesting questions a student might ask about this lecture.
Return ONLY a valid JSON array of 5 strings.`;

      const result = await this.aiClient.generateContent(prompt);
      const jsonMatch = result.response.text().trim().match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in response');

      const questions = JSON.parse(jsonMatch[0]);
      return Array.isArray(questions) && questions.length ? questions.slice(0, 5) : fallback;
    } catch (err) {
      logger.warn('generateStarterQuestions failed, using fallback', { error: err.message });
      return fallback;
    }
  }

  async generateTopicSegments(chunks) {
    try {
      if (!chunks?.length) return [];

      const duration = chunks[chunks.length - 1]?.endTime || chunks[chunks.length - 1]?.startTime || 0;
      const durationMin = Math.floor(duration / 60);
      const durationSec = Math.floor(duration % 60);

      // Intelligent chapter count: ~1 chapter per 90s, min 3 max 12
      const targetCount = Math.max(3, Math.min(12, Math.round(duration / 90)));

      // Send a dense sample covering the whole transcript with deep text context
      const step = Math.max(1, Math.ceil(chunks.length / 100));
      const sampled = chunks.filter((_, i) => i % step === 0).slice(0, 100);

      const context = sampled
        .map((c) => `[${fmt(c.startTime)}] ${c.text || ''}`)
        .join('\n');

      // ─── CRITICAL ELITE PROMPT ──────────────────────────────────────────────────
      const prompt = `You are a principal-level technical course architect, curriculum designer, and expert educational video analyst creating precise chapter markers for a lecture.

TOTAL VIDEO DURATION: ${durationMin}m ${durationSec}s (${Math.round(duration)}s)

TRANSCRIPT FLOW (with timestamps):
${context}

TASK: Segment the video into exactly ${targetCount} sequential chapters that capture the true intellectual progression of the lecture.

CRITICAL ARCHITECTURAL CONSTRAINTS — YOU MUST FOLLOW THESE DIRECTIVES:
❌ ZERO PLACEHOLDERS OR NUMERIC LABELS: Absolutely forbidden from using "Part 1", "Part 2", "Section A", "Overview of Part X", "Concept discussion", "Overview", "Introduction", "Part", "Segment", or ordinals anywhere in the topic title.
❌ NO GENERIC SUMMARIES: Do not start summaries with "concepts relating to", "overview of", "introduction to", "in this section", or similar filler phrases.
✅ CONCEPT-FIRST NAMING: Every single chapter topic MUST name the actual technical concept, software library, API endpoint, programming construct, or design pattern being explained. 

GOOD TECHNICAL EXAMPLES (LangChain/AI):
- "PromptTemplate Variable Injection"
- "LCEL RunnableSequence Pipeline"
- "OpenAI Chat Model Setup"
- "Output Parser Formatting"
- "RAG Context Retrieval Flow"
- "ConversationBufferMemory Setup"
- "Groq API Integration"
- "Chain Composition Patterns"

GOOD TECHNICAL EXAMPLES (Frontend/CSS):
- "Flexbox Alignment Deep Dive"
- "CSS Grid Template Areas"
- "Responsive Breakpoint Strategy"
- "Custom Property Theming"

Each chapter object must follow this structural JSON schema exactly:
[
  {
    "topic": "Specific Technical Concept Name (2-5 words, premium, textbook-grade title)",
    "startTime": 0,
    "startLabel": "0:00",
    "summary": "One precise, active educational sentence explaining what technical skill or design pattern the viewer will master in this segment (max 15 words).",
    "keywords": ["specificTechTerm1", "specificTechTerm2", "specificTechTerm3"],
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "importance": "Core" | "Supporting" | "Extra"
  }
]

RULES:
- The first chapter MUST start at 0 seconds.
- Every chapter startTime must be sorted in ascending order.
- The chapters must partition the full video duration (last chapter extending toward ${Math.round(duration)}s).
- Return ONLY valid JSON. No markdown backticks, no preamble, no commentary.`;
      // ───────────────────────────────────────────────────────────────────────────

      let segments = [];

      try {
        const result = await this.aiClient.generateContent(prompt);
        const text = result.response.text() || '';

        // Parse JSON
        const jsonMatch = text.trim().match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const raw = JSON.parse(jsonMatch[0]);
            if (Array.isArray(raw)) {
              segments = raw
                .filter((s) => s && s.topic && typeof s.startTime === 'number')
                .map((s) => {
                  // Find nearest transcript chunk text to use as context for programmatic ordinal purging
                  const nearestChunk = chunks.find(c => Math.abs(c.startTime - s.startTime) < 15) || chunks[0];
                  const chunkText = nearestChunk ? nearestChunk.text : '';
                  const cleanTopic = purgeGenericIdentifiers(s.topic, chunkText);

                  return {
                    topic: cleanTopic,
                    startTime: s.startTime,
                    startLabel: s.startLabel || fmt(s.startTime),
                    summary: sanitizeSummary(s.summary, cleanTopic),
                    keywords: sanitizeKeywords(s.keywords, cleanTopic),
                    difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(s.difficulty) ? s.difficulty : 'Intermediate',
                    importance: ['Core', 'Supporting', 'Extra'].includes(s.importance) ? s.importance : 'Core',
                  };
                });
            }
          } catch (jsonErr) {
            logger.warn('JSON parse failed, trying line parser', { error: jsonErr.message });
          }
        }

        // Line-by-line fallback
        if (segments.length === 0 && text.trim()) {
          const lines = text.split('\n');
          const tsRegex = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
          for (const line of lines) {
            const match = line.match(tsRegex);
            if (!match) continue;
            const hours = match[1] ? parseInt(match[1], 10) : 0;
            const minutes = parseInt(match[2], 10);
            const secs = parseInt(match[3], 10);
            const startTime = hours * 3600 + minutes * 60 + secs;

            let topic = line
              .replace(/\[[^\]]*\]/g, '')
              .replace(match[0], '')
              .replace(/[\-\/:*•]/g, ' ')
              .replace(/^\s*\d+[\.\s]*/, '')
              .replace(/\s+/g, ' ')
              .trim();

            const nearestChunk = chunks.find(c => Math.abs(c.startTime - startTime) < 15) || chunks[0];
            const chunkText = nearestChunk ? nearestChunk.text : '';
            const cleanTopic = purgeGenericIdentifiers(topic, chunkText);

            segments.push({
              topic: cleanTopic,
              startTime,
              startLabel: match[0],
              summary: sanitizeSummary('', cleanTopic),
              keywords: sanitizeKeywords([], cleanTopic),
              difficulty: 'Intermediate',
              importance: 'Core',
            });
          }
        }
      } catch (aiErr) {
        logger.error('AI topic generation failed', { error: aiErr.message });
      }

      // Deduplicate and sort
      const seen = new Set();
      segments = segments
        .sort((a, b) => a.startTime - b.startTime)
        .filter((s) => {
          if (seen.has(s.startTime)) return false;
          seen.add(s.startTime);
          return true;
        })
        .slice(0, 12);

      // If AI produced nothing useful, do a smart chunk-based fallback using
      // real transcript text as title source — never "Part N"
      if (segments.length === 0 && chunks.length > 0) {
        const chunkStep = Math.max(1, Math.ceil(chunks.length / targetCount));
        for (let i = 0; i < chunks.length; i += chunkStep) {
          const chunk = chunks[i];
          const rawText = (chunk.text || '').trim();
          const topic = extractPhraseTitle(rawText) || `Lecture Concept ${Math.floor(i / chunkStep) + 1}`;
          segments.push({
            topic,
            startTime: chunk.startTime,
            startLabel: chunk.startLabel || fmt(chunk.startTime),
            summary: `Covers key concepts starting at ${fmt(chunk.startTime)}.`,
            keywords: sanitizeKeywords([], rawText),
            difficulty: 'Intermediate',
            importance: 'Core',
          });
        }
      }

      // Guarantee chapter 0 exists
      if (segments.length > 0 && segments[0].startTime !== 0) {
        const firstText = (chunks[0]?.text || '').trim();
        segments.unshift({
          topic: extractPhraseTitle(firstText) || 'Getting Started',
          startTime: 0,
          startLabel: '0:00',
          summary: 'Opening section of the lecture.',
          keywords: sanitizeKeywords([], firstText),
          difficulty: 'Beginner',
          importance: 'Core',
        });
      } else if (segments.length === 0) {
        segments.push({
          topic: 'Getting Started',
          startTime: 0,
          startLabel: '0:00',
          summary: 'Opening section of the lecture.',
          keywords: [],
          difficulty: 'Beginner',
          importance: 'Core',
        });
      }

      return segments;
    } catch (err) {
      logger.warn('generateTopicSegments failed completely', { error: err.message });
      return [{ topic: 'Getting Started', startTime: 0, startLabel: '0:00', summary: '', keywords: [], difficulty: 'Beginner', importance: 'Core' }];
    }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function purgeGenericIdentifiers(title = '', textContext = '') {
  let clean = title.trim();

  // 1. Remove patterns like "Part 1:", "Part 2 -", "Section 3 -", "Chapter 4:", "Segment 5 -" case-insensitive
  clean = clean.replace(/^(?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic|overview|intro|introduction)\s*\d+[\s\:\-\–\—\•\.\,\|]*/i, '');

  // 2. Remove trailing part indicators like "- Part 1", "(Part 2)", "Part 3"
  clean = clean.replace(/[\s\:\-\–\—\•\.\,\|]+(?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+$/i, '');
  clean = clean.replace(/\((?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+\)$/i, '');

  // 3. Remove standalone ordinals like "1.", "First", "Second", "2."
  clean = clean.replace(/^\d+[\.\s\-]+/, '');

  clean = clean.trim();

  // 4. Check for generic strings and replace with transcript noun clusters
  const lower = clean.toLowerCase();
  const genericTerms = ['overview', 'introduction', 'intro', 'concepts', 'discussion', 'details', 'setup', 'conclusion', 'summary', 'wrapup', 'qa', 'q&a', 'questions', 'general', 'main', 'segment', 'part', 'section'];

  if (!clean || clean.length < 3 || genericTerms.includes(lower)) {
    const derived = extractPhraseTitle(textContext);
    if (derived) {
      clean = derived;
    } else {
      clean = 'Getting Started';
    }
  }

  // Ensure first character is uppercase
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function sanitizeSummary(text, topic) {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase();
  const bad = [
    'overview and concepts', 'overview of', 'concepts relating', 'introduction to',
    'in this section', 'this section covers', 'this chapter', 'an overview',
    'key concepts for', 'learn about the', 'discusses the',
  ];
  if (bad.some((b) => lower.includes(b))) return '';
  return text.trim();
}

const GENERIC_KEYWORDS = new Set([
  'part', 'section', 'chapter', 'overview', 'video', 'lecture', 'topic',
  'introduction', 'concept', 'concepts', 'this', 'that', 'with', 'from',
  'some', 'more', 'about', 'learn', 'understand', 'explain',
]);

const TECHNICAL_KEYWORDS = new Set([
  'prompt', 'prompttemplate', 'template', 'chain', 'runnable', 'pipeline', 'lcel', 'langchain',
  'embedding', 'embeddings', 'vector', 'vectorstore', 'vector database', 'retrieval', 'rag', 'groq',
  'openai', 'model', 'llm', 'callback', 'stream', 'streaming', 'memory', 'buffer', 'output', 'parser',
  'css', 'flexbox', 'grid', 'responsive', 'breakpoint', 'theme', 'theming', 'animation', 'scroll',
  'react', 'hook', 'state', 'effect', 'context', 'props', 'component', 'render', 'vitest', 'testing',
  'database', 'firestore', 'firebase', 'supabase', 'cloud', 'storage', 'node', 'express', 'middleware'
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
    .slice(0, 3)
    .map((w) => w.toLowerCase());
}

function extractPhraseTitle(text) {
  if (!text) return null;

  // Split into clean words
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  // Look for technical key terms first
  const foundTech = [];
  for (const word of words) {
    const lw = word.toLowerCase();
    if (TECHNICAL_KEYWORDS.has(lw) && !foundTech.includes(word)) {
      foundTech.push(word);
    }
  }

  if (foundTech.length >= 2) {
    const titleTech = foundTech.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' & ');
    return `Understanding ${titleTech}`;
  } else if (foundTech.length === 1) {
    const term = foundTech[0].charAt(0).toUpperCase() + foundTech[0].slice(1).toLowerCase();
    return `Configuring ${term}`;
  }

  // Fallback to taking first non-stop words
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
    return cleanWords.slice(0, 4).join(' ');
  }

  return null;
}

export default AiMetadataService;
