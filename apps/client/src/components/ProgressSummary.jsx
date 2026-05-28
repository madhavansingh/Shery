function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
}

export function ProgressTrack({ value = 0, className = '', fillClassName = '', height = 'h-2' }) {
  const pct = clampPercent(value);

  return (
    <div
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(pct)}
      className={`w-full overflow-hidden rounded-full bg-white/12 ${height} ${className}`}
    >
      <div
        className={`h-full rounded-full bg-accent transition-[width] duration-300 ease-out ${fillClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ProgressSummary({
  percent = 0,
  title,
  stats = [],
  action = null,
  className = '',
  compact = false,
}) {
  const pct = clampPercent(percent);
  const label = title || `${pct}% Complete`;

  return (
    <section className={`rounded-2xl border border-white/12 bg-surface-card ${compact ? 'p-3.5' : 'px-5 py-5'} ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className={`${compact ? 'text-xs' : 'text-[15px]'} font-bold text-accent`}>{label}</p>
        {action}
      </div>

      <ProgressTrack value={pct} height={compact ? 'h-1.5' : 'h-2'} />

      {stats.length > 0 && (
        <div className={`grid gap-4 ${compact ? 'mt-4 grid-cols-1' : 'mt-7 sm:grid-cols-3'}`}>
          {stats.map(({ label: statLabel, value }) => (
            <div key={statLabel} className={compact ? 'flex items-center justify-between gap-3' : ''}>
              <span className={`${compact ? 'text-[11px]' : 'text-sm'} text-muted-text`}>{statLabel}</span>
              <p className={`${compact ? 'text-xs' : 'text-base'} font-semibold text-white`}>
                <span className="text-white">{value}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
