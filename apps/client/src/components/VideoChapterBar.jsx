import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── shared design tokens (mirrors CustomVideoPlayer) ────────────────────────

const CHAPTER_COLORS = [
  { bar: '#6366f1', glow: 'rgba(99,102,241,0.6)',  accent: '#818cf8' },
  { bar: '#8b5cf6', glow: 'rgba(139,92,246,0.6)',  accent: '#a78bfa' },
  { bar: '#06b6d4', glow: 'rgba(6,182,212,0.6)',   accent: '#22d3ee' },
  { bar: '#10b981', glow: 'rgba(16,185,129,0.6)',  accent: '#34d399' },
  { bar: '#f59e0b', glow: 'rgba(245,158,11,0.6)',  accent: '#fbbf24' },
  { bar: '#ec4899', glow: 'rgba(236,72,153,0.6)',  accent: '#f472b6' },
  { bar: '#3b82f6', glow: 'rgba(59,130,246,0.6)',  accent: '#60a5fa' },
  { bar: '#f97316', glow: 'rgba(249,115,22,0.6)',  accent: '#fb923c' },
];

const DIFFICULTY_CONFIG = {
  Beginner:     { dot: '#4ade80', label: 'Foundational', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.2)',  text: '#4ade80' },
  Intermediate: { dot: '#fb923c', label: 'Intermediate',  bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)',  text: '#fb923c' },
  Advanced:     { dot: '#f87171', label: 'Advanced',      bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', text: '#f87171' },
};

const IMPORTANCE_CONFIG = {
  Core:       { label: 'Core',      bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', text: '#818cf8' },
  Supporting: { label: 'Context',   bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  text: '#22d3ee' },
  Extra:      { label: 'Deep Dive', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

// ─── utils ────────────────────────────────────────────────────────────────────

function fmtTime(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

const TECHNICAL_DISPLAY_KEYWORDS = new Set([
  'prompt', 'prompttemplate', 'template', 'chain', 'runnable', 'pipeline', 'lcel', 'langchain',
  'embedding', 'embeddings', 'vector', 'vectorstore', 'vector database', 'retrieval', 'rag', 'groq',
  'openai', 'model', 'llm', 'callback', 'stream', 'streaming', 'memory', 'buffer', 'output', 'parser',
  'css', 'flexbox', 'grid', 'responsive', 'breakpoint', 'theme', 'theming', 'animation', 'scroll',
  'react', 'hook', 'state', 'effect', 'context', 'props', 'component', 'render', 'vitest', 'testing',
  'database', 'firestore', 'firebase', 'gcs', 'cloud', 'storage', 'node', 'express', 'middleware'
]);

function deriveTechnicalDisplayTitle(text) {
  if (!text) return null;
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const foundTech = [];
  for (const word of words) {
    const lw = word.toLowerCase();
    if (TECHNICAL_DISPLAY_KEYWORDS.has(lw) && !foundTech.includes(word)) {
      foundTech.push(word);
    }
  }

  if (foundTech.length >= 2) {
    return `Understanding ${foundTech.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' & ')}`;
  } else if (foundTech.length === 1) {
    return `Configuring ${foundTech[0].charAt(0).toUpperCase() + foundTech[0].slice(1).toLowerCase()}`;
  }

  const stopwords = new Set(['a', 'an', 'the', 'is', 'it', 'to', 'of', 'in', 'and', 'or', 'but', 'we', 'so', 'that', 'this', 'about', 'some', 'more', 'with', 'from', 'okay', 'then']);
  const cleanWords = words
    .filter((w) => !stopwords.has(w.toLowerCase()))
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (cleanWords.length >= 2) {
    return cleanWords.slice(0, 4).join(' ');
  }
  return null;
}

function purgeDisplayGenericIdentifiers(title = '', fallbackText = '') {
  let clean = (title || '').trim();

  clean = clean.replace(/^(?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic|overview|intro|introduction)\s*\d+[\s\:\-\–\—\•\.\,\|]*/i, '');
  clean = clean.replace(/[\s\:\-\–\—\•\.\,\|]+(?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+$/i, '');
  clean = clean.replace(/\((?:part|section|chapter|segment|episode|module|unit|lecture|lesson|topic)\s*\d+\)$/i, '');
  clean = clean.replace(/^\d+[\.\s\-]+/, '');

  clean = clean.trim();

  const lower = clean.toLowerCase();
  const genericTerms = ['overview', 'introduction', 'intro', 'concepts', 'discussion', 'details', 'setup', 'conclusion', 'summary', 'wrapup', 'qa', 'q&a', 'questions', 'general', 'main', 'segment', 'part', 'section'];

  if (!clean || clean.length < 3 || genericTerms.includes(lower)) {
    const derived = deriveTechnicalDisplayTitle(fallbackText);
    if (derived) {
      clean = derived;
    } else {
      clean = 'Getting Started';
    }
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const GENERIC_KWS = new Set([
  'part','section','chapter','overview','video','lecture','topic',
  'introduction','concept','concepts','this','that','with','about',
]);

function sanitizeSummary(text) {
  if (!text) return '';
  const lower = (text || '').toLowerCase();
  const bad = [
    'overview and concepts','overview of','concepts relating','introduction to',
    'an overview','this section','this chapter','key learnings for','overview and key',
  ];
  if (bad.some((b) => lower.includes(b))) return '';
  return text.trim();
}

function sanitizeKeywords(kws) {
  if (!Array.isArray(kws) || !kws.length) return [];
  return kws
    .map((k) => String(k).toLowerCase().trim())
    .filter((k) => k.length > 2 && !GENERIC_KWS.has(k))
    .slice(0, 4);
}

// ─── Chapter hover card ───────────────────────────────────────────────────────

function ChapterCard({ chapter, color, pct, containerWidth }) {
  if (!chapter) return null;
  const difficulty = DIFFICULTY_CONFIG[chapter.difficulty] || DIFFICULTY_CONFIG.Intermediate;
  const importance = IMPORTANCE_CONFIG[chapter.importance]  || IMPORTANCE_CONFIG.Core;

  const cardW = 276;
  const rawLeft = (pct / 100) * (containerWidth || 600);
  const clamped = Math.min(Math.max(rawLeft, cardW / 2 + 6), (containerWidth || 600) - cardW / 2 - 6);
  const leftPct = (clamped / (containerWidth || 600)) * 100;
  const keywords = sanitizeKeywords(chapter.keywords);
  const summary   = sanitizeSummary(chapter.summary);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 440, damping: 32, mass: 0.55 }}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 16px)',
        left: `${leftPct}%`,
        transform: 'translateX(-50%)',
        width: cardW,
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(16,16,20,0.98) 0%, rgba(10,10,14,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.075)',
          boxShadow: '0 28px 72px rgba(0,0,0,0.75), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.055)',
          borderRadius: 13,
          overflow: 'hidden',
          backdropFilter: 'blur(28px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        }}
      >
        {/* Chapter color stripe */}
        <div style={{ height: 2, background: `linear-gradient(90deg, ${color.bar} 0%, ${color.bar}00 100%)` }} />

        <div style={{ padding: '11px 13px 13px' }}>
          {/* Timestamps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontFamily: '"SF Mono",ui-monospace,monospace', fontSize: 10, fontWeight: 600, color: color.accent, letterSpacing: '0.02em' }}>
              {fmtTime(chapter.start)} – {fmtTime(chapter.end)}
            </span>
            <span style={{ fontFamily: '"SF Mono",ui-monospace,monospace', fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.26)', letterSpacing: '0.04em' }}>
              {fmtDuration(chapter.duration)}
            </span>
          </div>

          {/* Title */}
          <h4 style={{ fontSize: 13, fontWeight: 650, color: '#fff', lineHeight: 1.3, letterSpacing: '-0.01em', marginBottom: summary ? 5 : 0, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif' }}>
            {chapter.topic}
          </h4>

          {/* Summary */}
          {summary && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 1.52, marginBottom: keywords.length ? 9 : 7, fontFamily: '-apple-system,sans-serif' }}>
              {summary}
            </p>
          )}

          {/* Keywords */}
          {keywords.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 9 }}>
              {keywords.map((kw, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 500, color: color.accent, background: `${color.bar}13`, border: `1px solid ${color.bar}26`, borderRadius: 5, padding: '2px 7px', fontFamily: '"SF Mono",ui-monospace,monospace' }}>
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Difficulty + Importance badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: difficulty.text, background: difficulty.bg, border: `1px solid ${difficulty.border}`, borderRadius: 20, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.03em', textTransform: 'uppercase', fontFamily: '-apple-system,sans-serif' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: difficulty.dot, display: 'inline-block' }} />
              {difficulty.label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: importance.text, background: importance.bg, border: `1px solid ${importance.border}`, borderRadius: 20, padding: '2px 8px', letterSpacing: '0.03em', textTransform: 'uppercase', fontFamily: '-apple-system,sans-serif' }}>
              {importance.label}
            </span>
          </div>
        </div>
      </div>

      {/* Caret */}
      <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 6, overflow: 'hidden' }}>
        <div style={{ width: 10, height: 10, background: 'rgba(16,16,20,0.98)', border: '1px solid rgba(255,255,255,0.075)', transform: 'rotate(45deg) translate(-3px,-3px)' }} />
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoChapterBar({ segments = [], duration = 0, currentTime = 0, onSeek }) {
  const railRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [hover, setHover] = useState({ visible: false, pct: 0, chapterIdx: -1 });

  useEffect(() => {
    if (!railRef.current) return;
    const obs = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    obs.observe(railRef.current);
    return () => obs.disconnect();
  }, []);

  if (!segments.length || !duration) return null;

  // Build chapters
  const chapters = segments.map((seg, i) => {
    const start = seg.startTime;
    const end   = i < segments.length - 1 ? segments[i + 1].startTime : duration;
    const dur   = Math.max(0, end - start);
    const cleanTopic = purgeDisplayGenericIdentifiers(seg.topic, seg.summary || seg.topic);
    return {
      ...seg,
      topic: cleanTopic,
      start,
      end,
      duration: dur,
      pctWidth: (dur / duration) * 100,
      summary:    sanitizeSummary(seg.summary),
      keywords:   sanitizeKeywords(seg.keywords),
      difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(seg.difficulty) ? seg.difficulty : 'Intermediate',
      importance: ['Core', 'Supporting', 'Extra'].includes(seg.importance)          ? seg.importance : 'Core',
    };
  });

  const activeIndex = chapters.reduce((acc, ch, i) => (currentTime >= ch.start ? i : acc), 0);
  const activeChapter = chapters[activeIndex];
  const activeColor   = CHAPTER_COLORS[activeIndex % CHAPTER_COLORS.length];

  const handleMouseMove = useCallback((e) => {
    if (!railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;
    let chapterIdx = chapters.findIndex((c) => time >= c.start && time <= c.end);
    if (chapterIdx < 0) chapterIdx = 0;
    setHover({ visible: true, pct: pct * 100, chapterIdx });
  }, [duration, chapters]);

  const handleMouseLeave = useCallback(() => {
    setHover((p) => ({ ...p, visible: false, chapterIdx: -1 }));
  }, []);

  return (
    <div className="pointer-events-none absolute bottom-[72px] left-0 right-0 z-30 px-4 pb-2.5 pt-7"
         style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.82) 100%)' }}>

      {/* Chapter timestamp labels row */}
      <div className="pointer-events-auto mb-1.5 flex gap-0.5">
        {chapters.map((ch, i) => {
          const active = i === activeIndex;
          const col    = CHAPTER_COLORS[i % CHAPTER_COLORS.length];
          return (
            <button
              key={`lbl-${i}`}
              type="button"
              style={{ width: `${ch.pctWidth}%` }}
              onClick={() => onSeek?.(ch.start)}
              className="min-w-0 cursor-pointer text-left"
            >
              <span
                className="block truncate px-0.5 text-[10px] font-semibold transition-colors duration-150"
                style={{ color: active ? col.accent : 'rgba(255,255,255,0.4)' }}
              >
                {ch.startLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeline rail */}
      <div
        ref={railRef}
        className="pointer-events-auto relative flex h-[5px] cursor-pointer gap-[2px] overflow-visible rounded-full transition-all duration-100 hover:h-2"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (!railRef.current) return;
          const rect = railRef.current.getBoundingClientRect();
          const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSeek?.(pct * duration);
        }}
      >
        {chapters.map((ch, idx) => {
          const col  = CHAPTER_COLORS[idx % CHAPTER_COLORS.length];
          const active = idx === activeIndex;
          const done   = currentTime >= ch.end;
          let playedPct = 0;
          if (done) {
            playedPct = 100;
          } else if (active) {
            playedPct = Math.max(0, Math.min(100, ((currentTime - ch.start) / ch.duration) * 100));
          }

          return (
            <div key={idx} style={{ width: `${ch.pctWidth}%` }} className="relative h-full overflow-hidden rounded-sm">
              {/* Track */}
              <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
              {/* Fill */}
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-75"
                style={{
                  width: `${playedPct}%`,
                  background: done
                    ? `${col.bar}bb`
                    : `linear-gradient(90deg, ${col.bar}, ${col.accent})`,
                  boxShadow: active ? `0 0 8px ${col.glow}` : 'none',
                }}
              />
              {/* Active shimmer */}
              {active && (
                <motion.div
                  className="pointer-events-none absolute inset-y-0 w-10 -skew-x-12"
                  style={{ left: `${playedPct}%`, background: `linear-gradient(90deg,transparent,${col.bar}45,transparent)` }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          );
        })}

        {/* Hover card */}
        <AnimatePresence>
          {hover.visible && hover.chapterIdx >= 0 && chapters[hover.chapterIdx] && (
            <ChapterCard
              chapter={chapters[hover.chapterIdx]}
              color={CHAPTER_COLORS[hover.chapterIdx % CHAPTER_COLORS.length]}
              pct={hover.pct}
              containerWidth={containerWidth}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Active chapter label strip */}
      <div className="mt-2 flex items-center gap-2 text-[11px] font-medium">
        <motion.span
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: activeColor.bar }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span
          className="truncate font-semibold"
          style={{ color: activeColor.accent, maxWidth: '60%' }}
        >
          {activeChapter?.topic}
        </span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
      </div>
    </div>
  );
}
