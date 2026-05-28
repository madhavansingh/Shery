import AppIcon from '../AppIcon';

export default function WorkspaceIngestionTimeline({ 
  progress = 0, 
  stageMessage = 'Initializing...', 
  status = 'pending',
  error = null,
  errorDetails = null,
  onRetry = null 
}) {
  // 8 visual core phases
  const phases = [
    { label: 'Queue', minPct: 5, icon: 'clock', desc: 'Queued for processing' },
    { label: 'Validate', minPct: 15, icon: 'shield', desc: 'File integrity check' },
    { label: 'Audio Extract', minPct: 25, icon: 'music', desc: 'Demuxing audio track' },
    { label: 'Speech AI', minPct: 35, icon: 'alignLeft', desc: 'Transcribing speech' },
    { label: 'Polish', minPct: 60, icon: 'edit', desc: 'Punctuation & stutters' },
    { label: 'Chunking', minPct: 75, icon: 'bookOpen', desc: 'Semantic semantic segments' },
    { label: 'Vectors', minPct: 88, icon: 'database', desc: 'Embedding indexing' },
    { label: 'Graph', minPct: 96, icon: 'share2', desc: 'Knowledge mapping' },
  ];

  const getPhaseStatus = (phase) => {
    if (status === 'error' || status === 'failed') return 'failed';
    if (progress >= phase.minPct || status === 'completed') return 'completed';
    // If current progress is close, mark as active
    if (progress > 0 && progress >= (phase.minPct - 12)) return 'active';
    return 'pending';
  };

  const isFailed = status === 'error' || status === 'failed';
  const isPartiallyReady = [
    'partially_ready', 'transcript_ready', 'enhancing_transcript', 'chunking', 'embedding', 'indexing', 'graph_building',
    'vector_ready', 'graph_ready', 'ready_without_vectors', 'indexing_pending', 'indexing_retrying', 'fully_indexed'
  ].includes(status);
  const isDegraded = ['ready_without_vectors', 'indexing_pending', 'indexing_retrying'].includes(status);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white/[0.02] to-white/[0.005] border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md select-none transition duration-300 hover:border-white/15">
      {/* Glow Effects */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl -z-10" />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isFailed 
              ? 'bg-alert/10 border-alert/20 text-alert' 
              : isDegraded
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : isPartiallyReady 
                  ? 'bg-accent/10 border-accent/20 text-accent animate-pulse'
                  : 'bg-white/[0.03] border-white/5 text-accent'
          }`}>
            <AppIcon 
              name={isFailed ? 'alertTriangle' : isDegraded ? 'database' : isPartiallyReady ? 'messageSquare' : 'loader'} 
              size={16} 
              className={!isFailed && !isPartiallyReady && !isDegraded ? 'animate-spin' : ''} 
            />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted block">
              SheryAI Ingestion Engine
            </span>
            <h3 className="text-sm font-bold text-white leading-tight">
              {isFailed ? 'Pipeline Interrupted' : isDegraded ? 'Indexing Pipeline Pending' : isPartiallyReady ? 'Partially Ready for Chat' : 'Active Ingestion Pipeline'}
            </h3>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isDegraded && (
            <span className="text-[9px] font-extrabold tracking-wider bg-amber-500/15 border border-amber-500/25 text-amber-400 px-2.5 py-0.5 rounded-full uppercase">
              Degraded Grounding
            </span>
          )}
          {isPartiallyReady && !isDegraded && (
            <span className="text-[9px] font-extrabold tracking-wider bg-accent/15 border border-accent/20 text-accent px-2.5 py-0.5 rounded-full uppercase animate-pulse">
              Partial Ready
            </span>
          )}
          <span className={`text-xs font-black px-3 py-1 rounded-full border ${
            isFailed 
              ? 'bg-alert/15 border-alert/25 text-alert' 
              : isDegraded
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-accent/10 border-accent/20 text-accent shadow-lg shadow-accent/5'
          }`}>
            {isFailed ? '0%' : isDegraded ? '60%' : `${progress}%`}
          </span>
        </div>
      </div>

      {/* Main Message Block */}
      <div className={`border p-4 rounded-2xl mb-6 transition duration-300 ${
        isFailed 
          ? 'bg-alert/5 border-alert/15 text-alert/90' 
          : isDegraded
            ? 'bg-amber-500/5 border-amber-500/10 text-amber-200/90'
            : 'bg-white/[0.02] border-white/5 text-white/90'
      }`}>
        <p className="text-xs font-semibold leading-relaxed">
          {isFailed ? (error || 'An unexpected stage timeout or coding failure occurred.') : stageMessage}
        </p>
        
        {isFailed && errorDetails?.suggestedAction && (
          <div className="mt-3 pt-3 border-t border-alert/10 flex items-start gap-2 text-[10px] text-muted">
            <AppIcon name="helpCircle" size={12} className="shrink-0 text-alert/65 mt-0.5" />
            <span>
              <strong className="text-alert/80 font-bold">Suggested Fix:</strong> {errorDetails.suggestedAction}
            </span>
          </div>
        )}

        {isDegraded && (
          <div className="mt-3 pt-3 border-t border-amber-500/10 flex items-start gap-2 text-[10px] text-amber-300/80">
            <AppIcon name="alertCircle" size={12} className="shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong className="font-bold">Notice:</strong> Vector database indexing is currently queued or retry-pending in the background. In the meantime, you can still chat immediately using the high-fidelity BM25 text/keyword search fallback!
            </span>
          </div>
        )}
      </div>

      {/* Process Track */}
      <div className="relative pt-6 pb-2 px-1">
        {/* Track Line background */}
        <div className="absolute top-[36px] left-5 right-5 h-[2px] bg-white/[0.05] -z-10" />
        
        {/* Active Track Line Progress */}
        <div 
          className={`absolute top-[36px] left-5 h-[2px] -z-10 transition-all duration-500 ease-out ${
            isFailed ? 'bg-alert/30' : isDegraded ? 'bg-amber-500/35' : 'bg-gradient-to-r from-accent to-accent-light'
          }`} 
          style={{ width: isFailed ? '0%' : `calc(${(isDegraded ? 84 : progress)}% - 30px)` }}
        />

        <div className="flex justify-between items-start gap-1">
          {phases.map((phase, idx) => {
            const phaseStatus = getPhaseStatus(phase);
            const isPhaseCompleted = phaseStatus === 'completed' || (isDegraded && phase.minPct <= 75);
            const isPhaseActive = phaseStatus === 'active' || (isDegraded && phase.minPct === 88);
            return (
              <div key={idx} className="flex flex-col items-center flex-1 min-w-0 group relative">
                {/* Node bubble */}
                <div 
                  className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                    isPhaseCompleted
                      ? 'bg-accent border-accent text-white shadow-lg shadow-accent/25 hover:scale-105'
                      : isPhaseActive
                        ? 'bg-surface-card border-accent text-accent scale-110 shadow-xl ring-4 ring-accent/15'
                        : phaseStatus === 'failed'
                          ? 'bg-alert/10 border-alert/20 text-alert opacity-50'
                          : 'bg-surface-card border-line text-muted hover:border-white/20'
                  }`}
                >
                  {isPhaseCompleted ? (
                    <AppIcon name="check" size={12} />
                  ) : (
                    <span className="text-[9px] font-black">{idx + 1}</span>
                  )}
                </div>
                
                {/* Node Label */}
                <span 
                  className={`text-[9px] font-black mt-3 text-center truncate w-full tracking-tight ${
                    isPhaseActive 
                      ? 'text-accent font-black' 
                      : isPhaseCompleted 
                        ? 'text-white/95 font-bold' 
                        : 'text-muted font-medium'
                  }`}
                >
                  {phase.label}
                </span>

                {/* Subtitle / desc */}
                <span className="text-[7px] text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center absolute -bottom-4 truncate w-16 whitespace-nowrap bg-surface-base border border-line px-1.5 py-0.5 rounded-md -z-10 group-hover:z-20">
                  {phase.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions footer if failed */}
      {isFailed && onRetry && (
        <div className="mt-8 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-alert/80 border border-alert hover:bg-alert rounded-xl transition duration-150 active:scale-95"
          >
            <AppIcon name="refresh" size={12} className="animate-spin-slow" />
            <span>Retry Ingestion Pipeline</span>
          </button>
        </div>
      )}

      {/* Capability Unlocking Grid */}
      <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/5 text-center">
        <div className={`p-2.5 rounded-2xl border transition duration-300 ${
          isPartiallyReady
            ? 'bg-accent/5 border-accent/15 text-accent'
            : 'bg-white/[0.01] border-white/5 text-muted opacity-50'
        }`}>
          <div className="flex justify-center mb-1">
            <AppIcon name={isPartiallyReady ? 'unlock' : 'lock'} size={12} />
          </div>
          <span className="text-[10px] font-bold block">Grounded Chat</span>
          <span className="text-[8px] text-muted block mt-0.5">
            {isPartiallyReady 
              ? (['vector_ready', 'graph_ready', 'completed', 'fully_indexed'].includes(status) ? 'Active (Semantic)' : 'Active (BM25)')
              : 'Locked'}
          </span>
        </div>

        <div className={`p-2.5 rounded-2xl border transition duration-300 ${
          ['vector_ready', 'graph_ready', 'completed', 'fully_indexed'].includes(status)
            ? 'bg-accent/5 border-accent/15 text-accent'
            : isDegraded
              ? 'bg-amber-500/5 border-amber-500/10 text-amber-400/80 animate-pulse'
              : 'bg-white/[0.01] border-white/5 text-muted opacity-50'
        }`}>
          <div className="flex justify-center mb-1">
            <AppIcon name={['vector_ready', 'graph_ready', 'completed', 'fully_indexed'].includes(status) ? 'unlock' : isDegraded ? 'database' : 'lock'} size={12} />
          </div>
          <span className="text-[10px] font-bold block">Semantic Search</span>
          <span className="text-[8px] text-muted block mt-0.5">
            {['vector_ready', 'graph_ready', 'completed', 'fully_indexed'].includes(status) 
              ? 'Active (Vectors)' 
              : isDegraded 
                ? 'Pending Recovery' 
                : 'Locked'}
          </span>
        </div>

        <div className={`p-2.5 rounded-2xl border transition duration-300 ${
          ['graph_ready', 'completed', 'fully_indexed'].includes(status)
            ? 'bg-accent/5 border-accent/15 text-accent'
            : 'bg-white/[0.01] border-white/5 text-muted opacity-50'
        }`}>
          <div className="flex justify-center mb-1">
            <AppIcon name={['graph_ready', 'completed', 'fully_indexed'].includes(status) ? 'unlock' : 'lock'} size={12} />
          </div>
          <span className="text-[10px] font-bold block">Concept Graph</span>
          <span className="text-[8px] text-muted block mt-0.5">
            {['graph_ready', 'completed', 'fully_indexed'].includes(status) ? 'Active' : 'Locked'}
          </span>
        </div>
      </div>
    </div>
  );
}
