import AppIcon from './AppIcon';
import { ProgressTrack } from './ProgressSummary';

const STATUS_META = {
  uploading: { label: 'Uploading', tone: 'accent', pulse: true },
  processing: { label: 'Processing', tone: 'accent', pulse: true },
  transcribing: { label: 'Transcribing', tone: 'amber', pulse: true },
  embedding: { label: 'Embedding', tone: 'accent', pulse: true },
  ready: { label: 'Ready', tone: 'green', pulse: false, icon: 'checkCircle' },
  failed: { label: 'Failed', tone: 'red', pulse: false, icon: 'xCircle' },
};

const toneClass = {
  accent: {
    badge: 'border-accent/40 bg-accent/15 text-accent',
    dot: 'bg-accent',
  },
  amber: {
    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-500',
    dot: 'bg-amber-500',
  },
  green: {
    badge: 'border-green-500/40 bg-green-500/15 text-green-500',
    dot: 'bg-green-500',
  },
  red: {
    badge: 'border-red-500/40 bg-red-500/15 text-red-500',
    dot: 'bg-red-500',
  },
};

export default function LessonStatusBadge({ status, progress = 0, chunkCount = 0, error }) {
  const meta = STATUS_META[status] || STATUS_META.processing;
  const tone = toneClass[meta.tone];

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-xs font-semibold ${tone.badge}`}>
        {meta.pulse && <span className={`h-[7px] w-[7px] animate-pulse rounded-full ${tone.dot}`} />}
        {meta.icon && <AppIcon name={meta.icon} size={13} />}
        {meta.label}
      </span>

      {meta.pulse && progress > 0 && (
        <div className="w-full max-w-[220px]">
          <ProgressTrack value={progress} height="h-1.5" />
          <p className="mt-1 text-[11px] text-slate-400">
            {progress}%{chunkCount > 0 ? ` · ${chunkCount} chunks` : ''}
          </p>
        </div>
      )}

      {status === 'failed' && error && <p className="max-w-[260px] text-xs text-red-500">{error}</p>}
      {status === 'ready' && chunkCount > 0 && <p className="text-[11px] text-green-500">{chunkCount} chunks indexed</p>}
    </div>
  );
}
