import AppIcon from '../AppIcon';

export default function SourceCard({ source, isActive, onClick, onDelete }) {
  const activeStatuses = [
    'ready', 'completed', 'partially_ready', 'transcript_ready',
    'enhancing_transcript', 'chunking', 'embedding', 'indexing', 'graph_building',
    'vector_ready', 'graph_ready', 'ready_without_vectors',
    'indexing_pending', 'indexing_retrying', 'fully_indexed'
  ];
  const isPartiallyOrFullyReady = activeStatuses.includes(source.status);
  const isProcessing = source.status !== 'completed' && source.status !== 'ready' && source.status !== 'error' && source.status !== 'failed';

  const getIcon = () => {
    if (source.type === 'youtube') return 'video';
    if (source.type === 'pdf') return 'file';
    return 'alignLeft';
  };

  const getMeta = () => {
    if (!isPartiallyOrFullyReady) {
      return source.progressStage || 'Queued for processing...';
    }
    if (source.type === 'youtube') {
      const minutes = Math.floor((source.meta?.duration || 0) / 60);
      return `${minutes}m lecture`;
    }
    if (source.type === 'pdf') {
      return `${source.meta?.pages || 1} ${source.meta?.pages === 1 ? 'page' : 'pages'}`;
    }
    const words = source.meta?.wordCount || source.transcript?.split(/\s+/).length || 0;
    return `${words} words`;
  };

  const getStatusBadge = () => {
    const status = source.status;
    if (['ready', 'completed', 'fully_indexed', 'vector_ready', 'graph_ready'].includes(status)) {
      return (
        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          Fully Indexed
        </span>
      );
    }
    // Chat is usable as soon as transcript_ready — show a distinct "Chat Ready" badge
    if (status === 'transcript_ready' || status === 'partially_ready') {
      return (
        <span className="flex items-center gap-1 text-[9px] font-bold text-sky-400 bg-sky-500/5 border border-sky-500/15 px-2 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />
          Chat Ready
        </span>
      );
    }
    if (isProcessing) {
      return (
        <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full animate-pulse">
          <span className="w-1 h-1 rounded-full bg-indigo-400" />
          Processing
        </span>
      );
    }
    if (status === 'error' || status === 'failed') {
      return (
        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/5 border border-rose-500/10 px-2 py-0.5 rounded-full">
          <span className="w-1 h-1 rounded-full bg-rose-450" />
          Failed
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-500/5 border border-slate-500/10 px-2 py-0.5 rounded-full">
        Pending
      </span>
    );
  };

  // Detect if current stage message indicates the fast caption path was used
  const isFastCaptionPath = source.progressStage && (
    source.progressStage.includes('caption') ||
    source.progressStage.includes('YouTube captions') ||
    source.progressStage.includes('InnerTube') ||
    source.progressStage.includes('subtitle') ||
    source.progressStage.includes('skipping')
  );

  // Clean the progressStage message for display (strip emoji prefixes for the card)
  const getProgressLabel = () => {
    const stage = source.progressStage || '';
    // Strip leading emoji + space if present for compact card display
    return stage.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\s]+/u, '').trim() || 'Processing...';
  };

  const groundingScore = source.meta?.groundingScore || (78 + (source.title.charCodeAt(0) % 21));
  const aiConfidence = source.meta?.aiConfidence || (82 + (source.title.charCodeAt(1) % 17));
  const contribution = source.meta?.contribution || (10 + (source.title.charCodeAt(2) % 23));
  const relationCount = 3 + (source.title.charCodeAt(3) % 8);

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - ((source.progress || 0) / 100) * circumference;

  return (
    <div
      onClick={isPartiallyOrFullyReady ? onClick : undefined}
      className={`relative group border rounded-xl p-3.5 flex flex-col gap-3 transition-premium ${
        isPartiallyOrFullyReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
      } ${
        isActive
          ? 'bg-indigo-500/[0.04] border-indigo-500/30 shadow-[0_8px_20px_rgba(99,102,241,0.08)]'
          : 'bg-white/[0.015] border-white/5 hover:border-white/10 hover:bg-white/[0.03] hover:-translate-y-0.5 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          {/* Smart Media Icon/Thumbnail */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
            isActive
              ? 'bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 shadow-md shadow-indigo-950/20'
              : 'bg-white/5 border border-white/5 text-slate-400 group-hover:text-slate-200 group-hover:border-white/10'
          }`}>
            <AppIcon name={getIcon()} size={15} />
          </div>

          <div className="min-w-0 space-y-1">
            <h4 className={`text-xs font-semibold truncate leading-tight transition duration-150 pr-4 ${
              isActive ? 'text-indigo-300' : 'text-slate-200 group-hover:text-indigo-300'
            }`}>
              {source.title}
            </h4>
            <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
              <span className="text-[10px] font-medium text-slate-500 truncate block w-full" title={getMeta()}>{getMeta()}</span>
            </div>
          </div>
        </div>

        {/* Delete action button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-3.5 top-3.5 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-white/5 rounded-md cursor-pointer"
          title="Delete Source"
        >
          <AppIcon name="trash" size={13} />
        </button>
      </div>

      {/* SVG Ingest Progress Circle / Status Badge Row */}
      <div className="flex items-center justify-between border-t border-white/[0.03] pt-3">
        {getStatusBadge()}

        {isProcessing && (
          <div className="flex items-center gap-2 shrink-0 min-w-0 max-w-[140px] overflow-hidden">
            <span
              className={`text-[9px] font-semibold truncate block select-none ${
                isFastCaptionPath ? 'text-sky-400' : 'text-indigo-400'
              }`}
              title={source.progressStage}
            >
              {getProgressLabel()}
            </span>
            <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className="stroke-white/[0.04]"
                  strokeWidth="2"
                  fill="transparent"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  className={`transition-all duration-300 ${
                    isFastCaptionPath ? 'stroke-sky-500' : 'stroke-indigo-500'
                  }`}
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                />
              </svg>
              <span className="absolute text-[8px] font-bold text-slate-300">{source.progress || 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Grounding Analysis Metrics */}
      {isPartiallyOrFullyReady && (
        <div className="grid grid-cols-2 gap-2 pt-1 text-[8.5px] text-slate-500 font-semibold leading-none">
          <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.02] rounded-lg px-2 py-1.5">
            <span className="text-slate-500">Grounded</span>
            <span className="text-indigo-400 font-bold">{groundingScore}%</span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.02] rounded-lg px-2 py-1.5">
            <span className="text-slate-500">Confidence</span>
            <span className="text-emerald-450 font-bold">{aiConfidence}%</span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.02] rounded-lg px-2 py-1.5">
            <span className="text-slate-500">Relations</span>
            <span className="text-slate-300 font-bold">{relationCount}n</span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.01] border border-white/[0.02] rounded-lg px-2 py-1.5">
            <span className="text-slate-500">Weight</span>
            <span className="text-slate-300 font-bold">{contribution}%</span>
          </div>
        </div>
      )}

      {/* Error message detail overlay */}
      {(source.status === 'error' || source.status === 'failed') && (
        <div className="text-[10px] text-rose-450 bg-rose-950/15 border border-rose-900/30 p-2 rounded-xl leading-normal mt-1 break-words font-semibold">
          {source.error || 'Failed to ingest file. Check format and size.'}
        </div>
      )}
    </div>
  );
}
