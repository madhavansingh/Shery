import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import AppIcon from './AppIcon';
import { SubtitleControls } from './SubtitleOverlay';

// ─── utils ────────────────────────────────────────────────────────────────────

function fmtTime(seconds = 0) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// Cinematic chapter palette — deep, rich, distinct but harmonious
const CHAPTER_COLORS = [
  { bar: '#6366f1', glow: 'rgba(99,102,241,0.6)', accent: '#818cf8' },   // indigo
  { bar: '#8b5cf6', glow: 'rgba(139,92,246,0.6)', accent: '#a78bfa' },   // violet
  { bar: '#06b6d4', glow: 'rgba(6,182,212,0.6)',  accent: '#22d3ee' },   // cyan
  { bar: '#10b981', glow: 'rgba(16,185,129,0.6)', accent: '#34d399' },   // emerald
  { bar: '#f59e0b', glow: 'rgba(245,158,11,0.6)', accent: '#fbbf24' },   // amber
  { bar: '#ec4899', glow: 'rgba(236,72,153,0.6)', accent: '#f472b6' },   // pink
  { bar: '#3b82f6', glow: 'rgba(59,130,246,0.6)', accent: '#60a5fa' },   // blue
  { bar: '#f97316', glow: 'rgba(249,115,22,0.6)', accent: '#fb923c' },   // orange
];

const DIFFICULTY_CONFIG = {
  Beginner:     { dot: '#4ade80', label: 'Foundational', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)', text: '#4ade80' },
  Intermediate: { dot: '#fb923c', label: 'Intermediate',  bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)',  text: '#fb923c' },
  Advanced:     { dot: '#f87171', label: 'Advanced',      bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', text: '#f87171' },
};

const IMPORTANCE_CONFIG = {
  Core:       { label: 'Core',      bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)', text: '#818cf8' },
  Supporting: { label: 'Context',   bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  text: '#22d3ee' },
  Extra:      { label: 'Deep Dive', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};

// ─── Chapter Hover Card ───────────────────────────────────────────────────────

function ChapterCard({ chapter, color, pct, timelineWidth }) {
  if (!chapter) return null;

  const difficulty = DIFFICULTY_CONFIG[chapter.difficulty] || DIFFICULTY_CONFIG.Intermediate;
  const importance = IMPORTANCE_CONFIG[chapter.importance] || IMPORTANCE_CONFIG.Core;

  // Card is 280px wide; clamp so it never bleeds off screen
  const cardW = 280;
  const rawLeft = (pct / 100) * (timelineWidth || 600);
  const clampedLeft = Math.min(Math.max(rawLeft, cardW / 2 + 4), (timelineWidth || 600) - cardW / 2 - 4);
  const offsetPct = (clampedLeft / (timelineWidth || 600)) * 100;

  const hasKeywords = Array.isArray(chapter.keywords) && chapter.keywords.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.6 }}
      style={{
        left: `${offsetPct}%`,
        transform: 'translateX(-50%)',
        width: cardW,
        bottom: 'calc(100% + 14px)',
      }}
      className="absolute z-50 pointer-events-none"
    >
      {/* The card */}
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(18,18,22,0.98) 0%, rgba(12,12,16,0.98) 100%)',
          border: `1px solid rgba(255,255,255,0.08)`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`,
          borderRadius: 14,
          overflow: 'hidden',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        }}
      >
        {/* Colored accent line at top */}
        <div style={{ height: 2, background: `linear-gradient(90deg, ${color.bar}, transparent)` }} />

        <div style={{ padding: '12px 14px 13px' }}>
          {/* Timestamp row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontFamily: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 600,
                color: color.accent,
                letterSpacing: '0.02em',
              }}
            >
              {fmtTime(chapter.start)} – {fmtTime(chapter.end)}
            </span>
            <span
              style={{
                fontFamily: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
                fontSize: 9,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.28)',
                letterSpacing: '0.04em',
              }}
            >
              {fmtDuration(chapter.duration)}
            </span>
          </div>

          {/* Topic title */}
          <h4
            style={{
              fontSize: 13,
              fontWeight: 650,
              color: '#ffffff',
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
              marginBottom: chapter.summary ? 6 : 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}
          >
            {chapter.topic}
          </h4>

          {/* Summary */}
          {chapter.summary && (
            <p
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 1.5,
                marginBottom: hasKeywords ? 10 : 8,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
            >
              {chapter.summary}
            </p>
          )}

          {/* Keywords */}
          {hasKeywords && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {chapter.keywords.slice(0, 4).map((kw, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    color: color.accent,
                    background: `${color.bar}14`,
                    border: `1px solid ${color.bar}28`,
                    borderRadius: 5,
                    padding: '2px 7px',
                    fontFamily: '"SF Mono", ui-monospace, monospace',
                    letterSpacing: '0.02em',
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Badges row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Difficulty */}
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: difficulty.text,
                background: difficulty.bg,
                border: `1px solid ${difficulty.border}`,
                borderRadius: 20,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                fontFamily: '-apple-system, sans-serif',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: difficulty.dot,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {difficulty.label}
            </span>

            {/* Importance */}
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: importance.text,
                background: importance.bg,
                border: `1px solid ${importance.border}`,
                borderRadius: 20,
                padding: '2px 8px',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                fontFamily: '-apple-system, sans-serif',
              }}
            >
              {importance.label}
            </span>
          </div>
        </div>
      </div>

      {/* Caret */}
      <div
        style={{
          position: 'absolute',
          bottom: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 10,
          height: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            background: 'rgba(18,18,22,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            transform: 'rotate(45deg) translate(-3px, -3px)',
          }}
        />
      </div>
    </motion.div>
  );
}

// ─── Segmented Timeline ───────────────────────────────────────────────────────

function SegmentedTimeline({
  chapters,
  currentTime,
  duration,
  onHover,
  onLeave,
  onSeek,
  hoverState,
}) {
  const railRef = useRef(null);
  const [timelineWidth, setTimelineWidth] = useState(600);

  useEffect(() => {
    if (!railRef.current) return;
    const obs = new ResizeObserver(([e]) => setTimelineWidth(e.contentRect.width));
    obs.observe(railRef.current);
    return () => obs.disconnect();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!duration || !railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const time = pct * duration;
    // Store index, NOT object reference — chapters array rebuilds each render
    let chapterIdx = chapters.findIndex((ch) => time >= ch.start && time <= ch.end);
    if (chapterIdx < 0) chapterIdx = 0;
    onHover({ visible: true, time, pct: pct * 100, x, chapterIdx });
  }, [duration, chapters, onHover]);

  const handleMouseLeave = useCallback(() => {
    onLeave();
  }, [onLeave]);

  const handleClick = useCallback((e) => {
    if (!duration || !railRef.current) return;
    const rect = railRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  return (
    <div
      ref={railRef}
      className="group/tl relative flex h-2 w-full cursor-pointer items-center gap-[2px] transition-all hover:h-3"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={currentTime}
    >
      {chapters.map((ch, idx) => {
        const color = CHAPTER_COLORS[idx % CHAPTER_COLORS.length];
        const isActive = currentTime >= ch.start && currentTime < ch.end;
        const isDone = currentTime >= ch.end;
        const isHovered = hoverState.visible && hoverState.chapterIdx === idx;

        let playedPct = 0;
        if (isDone) {
          playedPct = 100;
        } else if (isActive) {
          playedPct = Math.max(0, Math.min(100, ((currentTime - ch.start) / ch.duration) * 100));
        }

        return (
          <div
            key={idx}
            style={{ width: `${ch.pctWidth}%` }}
            className="relative h-full overflow-hidden rounded-sm"
          >
            {/* Track background */}
            <div
              className="absolute inset-0 transition-opacity duration-150"
              style={{
                background: isHovered
                  ? `linear-gradient(90deg, ${color.bar}30, ${color.bar}18)`
                  : 'rgba(255,255,255,0.1)',
                opacity: isHovered ? 1 : 1,
              }}
            />

            {/* Filled / played portion */}
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-75"
              style={{
                width: `${playedPct}%`,
                background: isDone
                  ? `${color.bar}cc`
                  : `linear-gradient(90deg, ${color.bar}, ${color.accent})`,
                boxShadow: isActive ? `0 0 10px ${color.glow}` : 'none',
              }}
            />

            {/* Active pulse shimmer */}
            {isActive && (
              <motion.div
                className="absolute inset-y-0 w-12 -skew-x-12 pointer-events-none"
                style={{
                  left: `${playedPct}%`,
                  background: `linear-gradient(90deg, transparent, ${color.bar}40, transparent)`,
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        );
      })}

      {/* Scrub thumb */}
      {duration > 0 && (
        <div
          className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/tl:opacity-100"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div
            className="h-4 w-4 rounded-full border-2 border-white bg-white shadow-lg"
            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 4px 12px rgba(0,0,0,0.6)' }}
          />
        </div>
      )}

      {/* Hover tooltip card */}
      <AnimatePresence>
        {hoverState.visible && hoverState.chapterIdx >= 0 && chapters[hoverState.chapterIdx] && (
          <ChapterCard
            chapter={chapters[hoverState.chapterIdx]}
            color={CHAPTER_COLORS[hoverState.chapterIdx % CHAPTER_COLORS.length]}
            pct={hoverState.pct}
            timelineWidth={timelineWidth}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────────────────────────

const CustomVideoPlayer = forwardRef(function CustomVideoPlayer(
  { src, title, className = '', onLoadedMetadata, onTimeUpdate, onError, subtitles, segments = [] },
  ref
) {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hoverState, setHoverState] = useState({ visible: false, time: 0, pct: 0, x: 0, chapterIdx: -1 });

  useImperativeHandle(ref, () => videoRef.current);

  useEffect(() => {
    const fn = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
    setControlsVisible(true);
  }, [src]);

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true);
      return undefined;
    }
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    return () => window.clearTimeout(hideTimerRef.current);
  }, [playing]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { await v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const seek = useCallback((value) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(value);
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const skipBy = useCallback((secs) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.min(Math.max((v.currentTime || 0) + secs, 0), duration || v.duration || 0);
    v.currentTime = t;
    setCurrentTime(t);
    revealControls();
  }, [duration, revealControls]);

  const changeVolume = useCallback((value) => {
    const next = Number(value);
    const v = videoRef.current;
    setVolume(next);
    setMuted(next === 0);
    if (v) { v.volume = next; v.muted = next === 0; }
  }, []);

  const toggleMuted = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next && v.volume === 0) { v.volume = 0.75; setVolume(0.75); }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!shellRef.current) return;
    if (document.fullscreenElement) { await document.exitFullscreen?.(); }
    else { await shellRef.current.requestFullscreen?.(); }
  }, []);

  const changePlaybackRate = useCallback(() => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length] || 1;
    const v = videoRef.current;
    if (v) v.playbackRate = next;
    setPlaybackRate(next);
    revealControls();
  }, [playbackRate, revealControls]);

  // Build chapters with proportional widths
  const safeSegments = Array.isArray(segments) ? segments : [];
  const chapters = [];

  if (safeSegments.length > 0 && duration > 0) {
    for (let i = 0; i < safeSegments.length; i++) {
      const start = safeSegments[i].startTime;
      const end = i < safeSegments.length - 1 ? safeSegments[i + 1].startTime : duration;
      const dur = Math.max(0, end - start);
      const cleanTopic = purgeDisplayGenericIdentifiers(safeSegments[i].topic, safeSegments[i].summary || safeSegments[i].topic);
      chapters.push({
        ...safeSegments[i],
        topic: cleanTopic,
        start,
        end,
        duration: dur,
        pctWidth: (dur / duration) * 100,
        summary: sanitizeDisplaySummary(safeSegments[i].summary, cleanTopic),
        keywords: sanitizeDisplayKeywords(safeSegments[i].keywords, cleanTopic),
        difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(safeSegments[i].difficulty)
          ? safeSegments[i].difficulty
          : 'Intermediate',
        importance: ['Core', 'Supporting', 'Extra'].includes(safeSegments[i].importance)
          ? safeSegments[i].importance
          : 'Core',
      });
    }
  }

  if (chapters.length === 0 && duration > 0) {
    chapters.push({
      topic: title || 'Video',
      start: 0,
      end: duration,
      duration,
      pctWidth: 100,
      summary: '',
      keywords: [],
      difficulty: 'Intermediate',
      importance: 'Core',
    });
  }

  let activeChapterIdx = -1;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (currentTime >= chapters[i].start) { activeChapterIdx = i; break; }
  }
  const activeChapter = activeChapterIdx >= 0 ? chapters[activeChapterIdx] : null;
  const activeColor = CHAPTER_COLORS[Math.max(0, activeChapterIdx) % CHAPTER_COLORS.length];

  return (
    <div
      ref={shellRef}
      className={`group relative h-full w-full overflow-hidden bg-black ${className}`}
      onMouseMove={revealControls}
      onMouseEnter={revealControls}
      onTouchStart={revealControls}
      onFocusCapture={revealControls}
    >
      {/* Click-to-play layer */}
      <button
        type="button"
        aria-label={playing ? 'Pause video' : 'Play video'}
        onClick={togglePlay}
        className="absolute inset-0 z-10 cursor-pointer"
      >
        <span className="sr-only">{playing ? 'Pause video' : 'Play video'}</span>
      </button>

      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        title={title}
        className="block h-full w-full bg-black object-contain"
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          onLoadedMetadata?.(e);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime || 0);
          onTimeUpdate?.(e);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setControlsVisible(true); }}
        onEnded={() => setPlaying(false)}
        onError={onError}
      />

      {/* Pause overlay icon */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-2xl backdrop-blur">
            <AppIcon name="play" size={28} />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-16 text-white transition-all duration-200 sm:px-4 ${
          controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        {/* ── Timeline ── */}
        <div className="mb-3">
          <SegmentedTimeline
            chapters={chapters}
            currentTime={currentTime}
            duration={duration}
            hoverState={hoverState}
            onHover={setHoverState}
            onLeave={() => setHoverState((p) => ({ ...p, visible: false, chapterIdx: -1 }))}
            onSeek={seek}
          />
        </div>

        {/* ── Control bar ── */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/18"
          >
            <AppIcon name={playing ? 'pause' : 'play'} size={17} />
          </button>

          {/* Skip buttons */}
          <button
            type="button"
            onClick={() => skipBy(-10)}
            aria-label="Skip back 10s"
            className="hidden h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-white/8 px-2 font-mono text-[11px] font-bold text-white transition hover:bg-white/16 sm:inline-flex"
          >
            -10
          </button>
          <button
            type="button"
            onClick={() => skipBy(10)}
            aria-label="Skip forward 10s"
            className="hidden h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-white/8 px-2 font-mono text-[11px] font-bold text-white transition hover:bg-white/16 sm:inline-flex"
          >
            +10
          </button>

          {/* Time */}
          <span className="min-w-[86px] font-mono text-[11px] text-white/60">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          {/* Active chapter label */}
          {activeChapter && (
            <div
              className="hidden md:inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-medium max-w-[220px] lg:max-w-[340px] truncate"
              style={{
                background: `${activeColor.bar}12`,
                border: `1px solid ${activeColor.bar}28`,
                color: activeColor.accent,
              }}
            >
              <motion.span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: activeColor.bar }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="truncate">{activeChapter.topic}</span>
            </div>
          )}

          {/* Right side controls */}
          <div className="ml-auto flex items-center gap-2">
            {subtitles && <SubtitleControls subtitles={subtitles} placement="top" />}
            <button
              type="button"
              onClick={changePlaybackRate}
              aria-label="Change playback speed"
              className="flex h-8 min-w-10 items-center justify-center rounded-lg border border-white/10 bg-white/8 px-2 font-mono text-[11px] font-bold text-white transition hover:bg-white/16"
            >
              {playbackRate}x
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-white transition hover:bg-white/16"
            >
              <AppIcon name={muted ? 'volumeX' : 'volume'} size={16} />
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(e.target.value)}
              aria-label="Video volume"
              className="hidden h-1 w-20 cursor-pointer accent-white/60 sm:block"
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/8 text-white transition hover:bg-white/16"
            >
              <AppIcon name={fullscreen ? 'minimize' : 'maximize'} size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CustomVideoPlayer;

// ─── Display sanitizers (client-side) ─────────────────────────────────────────

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

  // Remove Part 1, Section 2, Chapter 3 etc
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

function sanitizeDisplaySummary(text, topic) {
  if (!text || typeof text !== 'string') return '';
  const lower = text.toLowerCase();
  const bad = [
    'overview and concepts', 'overview of', 'concepts relating', 'introduction to',
    'an overview', 'this section', 'this chapter', 'overview and key',
    'overview and topics', 'key learnings', 'key concepts for',
  ];
  if (bad.some((b) => lower.includes(b))) return '';
  return text.trim();
}

const GENERIC_DISPLAY_KWS = new Set([
  'part', 'section', 'chapter', 'overview', 'video', 'lecture', 'topic',
  'introduction', 'concept', 'this', 'that', 'with', 'from', 'about',
]);

function sanitizeDisplayKeywords(kws, topic) {
  if (Array.isArray(kws) && kws.length > 0) {
    const clean = kws
      .map((k) => String(k).toLowerCase().trim())
      .filter((k) => k.length > 2 && !GENERIC_DISPLAY_KWS.has(k));
    if (clean.length > 0) return clean.slice(0, 4);
  }
  return [];
}
