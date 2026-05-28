import { memo, useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';

export function SubtitleControls({ subtitles }) {
  const [showPanel, setShowPanel] = useState(false);
  const wrapRef = useRef(null);
  const { enabled, toggleEnabled, language, changeLanguage, hasTranscript, loading } = subtitles;
  const canToggle = hasTranscript || loading;

  useEffect(() => {
    const close = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setShowPanel(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => canToggle && toggleEnabled()}
        title={loading ? 'Loading transcript...' : !hasTranscript ? 'No transcript available' : enabled ? 'Disable subtitles' : 'Enable subtitles'}
        className={`flex h-[26px] min-w-9 items-center justify-center rounded-md px-2 text-[11px] font-extrabold tracking-wider text-white backdrop-blur disabled:cursor-not-allowed disabled:opacity-40 ${
          enabled ? 'border-2 border-white bg-white/20' : 'border border-white/30 bg-black/60'
        }`}
        disabled={!canToggle}
      >
        {loading ? <AppIcon name="loader" size={12} className="animate-spin" /> : 'CC'}
      </button>

      {enabled && hasTranscript && (
        <button
          type="button"
          onClick={() => setShowPanel((value) => !value)}
          title="Subtitle language"
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-md border text-white backdrop-blur ${
            showPanel ? 'border-white/40 bg-white/20' : 'border-white/20 bg-black/60'
          }`}
        >
          <AppIcon name="settings" size={14} />
        </button>
      )}

      {showPanel && (
        <div className="absolute top-[34px] right-0 z-[9999] w-[198px] rounded-[10px] border border-white/10 bg-[#0c0c12]/95 px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Subtitle Language</p>
          {[
            { id: 'english', label: 'English', sub: 'Roman script only' },
            { id: 'hinglish', label: 'Hinglish', sub: 'Auto Roman transliteration' },
          ].map((option) => {
            const active = language === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  changeLanguage(option.id);
                  setShowPanel(false);
                }}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                  active ? 'border-accent/45 bg-accent/15' : 'border-transparent'
                }`}
              >
                <span className={`h-[13px] w-[13px] rounded-full border-2 ${active ? 'border-accent bg-accent' : 'border-white/25'}`} />
                <span>
                  <span className="block text-xs font-semibold text-white">{option.label}</span>
                  <span className="block text-[10px] text-white/40">{option.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SubtitleOverlay = memo(function SubtitleOverlay({ subtitles }) {
  const { enabled, captionState } = subtitles;
  const { words } = captionState || { words: [] };
  if (!enabled || !words || words.length === 0) return null;

  return (
    <div aria-live="polite" aria-label="Video subtitles" className="pointer-events-none absolute bottom-[8%] left-1/2 z-[200] flex w-full max-w-[90%] -translate-x-1/2 justify-center">
      <div className="inline-block max-w-full rounded-md bg-black/75 px-4 py-2 text-center shadow-[0_2px_12px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="break-words text-center text-[clamp(14px,1.8vw,22px)] font-semibold leading-snug tracking-wide text-white drop-shadow">
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="mr-[0.25em] inline-block last:mr-0">
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default SubtitleOverlay;
