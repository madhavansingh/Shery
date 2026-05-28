import { useState, useEffect, useRef, useCallback } from 'react';
import { getLessonTranscript } from '../services/api';
import { normalizeWord } from '../shared/utils/transliterate.js';

function buildSentenceBlocks(chunks) {
  if (!chunks?.length) return [];

  const sorted = [...chunks]
    .map((chunk) => {
      const startTime = Number(chunk.startTime ?? chunk.start ?? chunk.offset ?? 0);
      const endTime = Number(chunk.endTime ?? chunk.end ?? chunk.startTime + chunk.duration ?? startTime);
      return {
        ...chunk,
        startTime,
        endTime: endTime > startTime ? endTime : startTime + Math.max(Number(chunk.duration || 0), 0),
        text: chunk.text || chunk.caption || chunk.content || '',
      };
    })
    .filter((chunk) => chunk.text?.trim() && Number.isFinite(chunk.startTime) && Number.isFinite(chunk.endTime))
    .sort((a, b) => a.startTime - b.startTime);
  const blocks = [];

  let currentWords = [];
  let blockStart  = -1;
  let blockEnd    = -1;

  const flushBlock = () => {
    if (currentWords.length > 0) {
      blocks.push({ startTime: blockStart, endTime: blockEnd, words: currentWords });
      currentWords = [];
    }
  };

  const MAX_WORDS = 12;

  for (const chunk of sorted) {
    if (!chunk.text?.trim()) continue;
    const words = chunk.text.split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    const startTime = chunk.startTime;
    const endTime   = chunk.endTime;
    if (startTime >= endTime) continue;

    const wordDuration = (endTime - startTime) / words.length;

    if (currentWords.length > 0 && startTime - blockEnd > 0.8) {
      flushBlock();
    }

    for (let i = 0; i < words.length; i++) {
      if (currentWords.length === 0) blockStart = startTime + i * wordDuration;

      const wordText = words[i];
      const wTs      = startTime + i * wordDuration;
      currentWords.push({ word: wordText, ts: wTs });
      blockEnd = startTime + (i + 1) * wordDuration;

      const isEndOfSentence = /[.!?]$/.test(wordText);

      if (currentWords.length >= MAX_WORDS || (isEndOfSentence && currentWords.length >= 4)) {
        flushBlock();
      }
    }
  }

  flushBlock();
  return blocks;
}

function findActiveBlock(blocks, t) {
  if (!blocks.length) return -1;
  if (t < blocks[0].startTime) return -1;
  if (t >= blocks[blocks.length - 1].endTime) {
    return t - blocks[blocks.length - 1].endTime < 0.5 ? blocks.length - 1 : -1;
  }

  let lo = 0, hi = blocks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b   = blocks[mid];
    if      (t < b.startTime) hi = mid - 1;
    else if (t >= b.endTime)  lo = mid + 1;
    else return mid;
  }

  const prev = lo - 1;
  if (prev >= 0 && t - blocks[prev].endTime < 0.5) return prev;
  return -1;
}

function visibleWordCount(block, t) {
  if (t < block.startTime) return 0;
  if (t >= block.endTime)  return block.words.length;

  let lo = 0, hi = block.words.length - 1, result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (block.words[mid].ts <= t) { result = mid + 1; lo = mid + 1; }
    else                           { hi = mid - 1; }
  }
  return result;
}

export function useSubtitles(lessonId, videoRef, currentTimeRef) {
  const [enabled,      setEnabled]      = useState(false);
  const [language,     setLanguage]     = useState('hinglish');
  const [hasTranscript, setHasTranscript] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [captionState, setCaptionState] = useState({ words: [], isNew: false });
  const [blocks,       setBlocks]       = useState([]);
  const [rawChunks,    setRawChunks]    = useState([]);

  const enabledRef   = useRef(false);
  const blocksRef    = useRef([]);
  const languageRef  = useRef('hinglish');
  const rafRef       = useRef(null);
  const lastBlockRef = useRef(-1);
  const lastCountRef = useRef(0);
  const lastTimeRef  = useRef(-1);

  useEffect(() => { enabledRef.current  = enabled;  }, [enabled]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const loopFn = useRef(null);
  loopFn.current = () => {
    if (!enabledRef.current || !blocksRef.current.length) {
      rafRef.current = requestAnimationFrame(loopFn.current);
      return;
    }

    let t = 0;
    if (videoRef?.current)              t = videoRef.current.currentTime || 0;
    else if (currentTimeRef?.current != null) t = currentTimeRef.current;

    const didSeek = lastTimeRef.current !== -1 && Math.abs(t - lastTimeRef.current) > 2.0;
    if (didSeek) {
      lastBlockRef.current = -1;
      lastCountRef.current = 0;
    }
    lastTimeRef.current = t;

    const blocks   = blocksRef.current;
    const blockIdx = findActiveBlock(blocks, t);

    if (blockIdx < 0) {
      if (lastBlockRef.current !== -1 || lastCountRef.current !== 0) {
        lastBlockRef.current = -1;
        lastCountRef.current = 0;
        setCaptionState({ words: [], isNew: false });
      }
      rafRef.current = requestAnimationFrame(loopFn.current);
      return;
    }

    const block = blocks[blockIdx];
    const count = visibleWordCount(block, t);
    const lang  = languageRef.current;

    const blockChanged = blockIdx !== lastBlockRef.current;
    const countChanged = count   !== lastCountRef.current;

    if (blockChanged || countChanged) {
      lastBlockRef.current = blockIdx;
      lastCountRef.current = count;

      const words = block.words
        .slice(0, count)
        .map(e => normalizeWord(e.word, lang))
        .filter(Boolean);

      setCaptionState({ words, isNew: blockChanged });
    }

    rafRef.current = requestAnimationFrame(loopFn.current);
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loopFn.current);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCaptionState({ words: [], isNew: false });
      lastBlockRef.current = -1;
      lastCountRef.current = 0;
      lastTimeRef.current  = -1;
    }
  }, [enabled]);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    setHasTranscript(false);
    setCaptionState({ words: [], isNew: false });
    blocksRef.current = [];

    getLessonTranscript(lessonId)
      .then(data => {
        const chunks = data.chunks || data.transcriptChunks || data.transcript?.chunks || data.items || [];
        if ((data.success !== false) && chunks.length > 0) {
          const built = buildSentenceBlocks(chunks);
          blocksRef.current = built;
          setHasTranscript(built.length > 0);
          setBlocks(built);
          setRawChunks(chunks);
        } else {
          setError('No transcript available.');
        }
      })
      .catch(() => setError('Could not load transcript.'))
      .finally(() => setLoading(false));

    return () => {
      blocksRef.current    = [];
      lastBlockRef.current = -1;
      lastCountRef.current = 0;
      lastTimeRef.current  = -1;
      setCaptionState({ words: [], isNew: false });
      setHasTranscript(false);
      setBlocks([]);
      setRawChunks([]);
    };
  }, [lessonId]);

  const toggleEnabled  = useCallback(() => setEnabled(e => !e), []);
  const changeLanguage = useCallback(lang => setLanguage(lang), []);

  return {
    enabled,
    toggleEnabled,
    language,
    changeLanguage,
    captionState,
    hasTranscript,
    loading,
    error,
    blocks,
    rawChunks,
  };
}
