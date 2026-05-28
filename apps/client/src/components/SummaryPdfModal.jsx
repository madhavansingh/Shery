import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';
import { useLectureSummaryMutation } from '../api/chatQueries';
import { downloadSummaryPDF } from '../utils/summaryPdf';

function renderSummary(text) {
  if (!text) return null;
  return text.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-2" />;
    
    // Parse Markdown basic formats
    if (trimmed.startsWith('### ')) return <h3 key={index} className="mt-4 mb-2 text-base font-bold text-white">{trimmed.slice(4)}</h3>;
    if (trimmed.startsWith('## ')) return <h2 key={index} className="mt-5 mb-2 text-lg font-extrabold text-[#e8572a]">{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith('# ')) return <h1 key={index} className="mb-3 text-xl font-black text-white">{trimmed.slice(2)}</h1>;
    if (trimmed.startsWith('- ')) {
      // Basic bold parsing for UI (e.g. **text**)
      const content = trimmed.slice(2).split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        return part;
      });
      return <p key={index} className="pl-4 text-[13px] leading-7 text-slate-300"><span className="text-[#e8572a] mr-1.5">•</span> {content}</p>;
    }
    return <p key={index} className="text-[13px] leading-7 text-slate-300">{trimmed}</p>;
  });
}

export default function SummaryPdfModal({ lessonId, lessonTitle, onClose }) {
  const [type, setType] = useState('full');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const summaryMutation = useLectureSummaryMutation();

  const fetchSummary = async (nextType) => {
    setType(nextType);
    setLoading(true);
    setSummary('');
    try {
      const data = await summaryMutation.mutateAsync({ lessonId, type: nextType });
      setSummary(data.summary || 'No summary available.');
    } catch {
      setSummary('Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary('full');
  }, [lessonId]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-6 backdrop-blur" onClick={onClose}>
      <section
        className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12] shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-6 pb-4 pt-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2.5">
                <AppIcon name="file" size={22} className="text-[#e8572a]" />
                <h3 className="text-lg font-extrabold text-white">Lecture Summary</h3>
              </div>
              {lessonTitle && (
                <p className="text-xs text-slate-400">
                  <AppIcon name="book" size={13} className="mr-1 inline-block" /> {lessonTitle}
                </p>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Close summary" className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-400 hover:text-white transition">
              <AppIcon name="x" size={16} />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {[
                ['full', 'Full Lecture'],
                ['last5min', 'Last 5 Min'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => fetchSummary(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    type === value ? 'border-[#e8572a]/30 bg-[#e8572a]/10 text-[#e8572a]' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            
            <button
              type="button"
              disabled={!summary || loading}
              onClick={() => downloadSummaryPDF(summary, lessonTitle)}
              className="rounded-lg bg-[#e8572a] hover:bg-[#d44820] transition px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#e8572a]/20 disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none"
            >
              Download PDF
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <AppIcon name="loader" size={42} className="animate-spin text-[#e8572a]" />
              <p className="text-sm text-slate-400">Generating your summary with AI...</p>
            </div>
          ) : (
            <div className="pb-8">{renderSummary(summary)}</div>
          )}
        </div>
      </section>
    </div>
  );
}
