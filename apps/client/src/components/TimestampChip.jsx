import AppIcon from './AppIcon';

export default function TimestampChip({ label, startTime, onSeek }) {
  const handleClick = () => {
    if (typeof onSeek === 'function') onSeek(startTime);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Jump to ${label}`}
      className="mx-[3px] inline-flex select-none items-center gap-1 whitespace-nowrap rounded-full border border-accent-border bg-accent/10 px-[9px] py-0.5 align-middle font-mono text-[11px] font-bold tracking-wide text-accent transition hover:border-accent hover:bg-accent/20 hover:shadow-[0_0_10px_rgba(232,87,42,0.35)]"
    >
      <AppIcon name="play" size={10} />
      {label}
    </button>
  );
}

function labelToSeconds(label) {
  if (!label) return 0;
  const parts = label.trim().split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function parseTimestamps(text, onSeek) {
  if (!text) return [text];

  const timePattern = '\\d{1,2}:\\d{2}(?::\\d{2})?';
  const rangePattern = '\\s*[-\u2013\u2014]\\s*';
  const re = new RegExp(`([\\(\\[])?(${timePattern})(?:${rangePattern}(${timePattern}))?([\\)\\]])?`, 'g');

  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    const opening = match[1];
    const closing = match[4];
    const wrapped = Boolean(opening && closing);
    const before = text[match.index - 1] || '';
    const after = text[re.lastIndex] || '';
    const bareTouchesWord = !wrapped && ((before && /[A-Za-z0-9]/.test(before)) || (after && /[A-Za-z0-9]/.test(after)));

    if (bareTouchesWord) continue;
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));

    const startLabel = match[2];
    const endLabel = match[3];
    parts.push(
      <TimestampChip
        key={`ts-${match.index}`}
        label={endLabel ? `${startLabel} - ${endLabel}` : startLabel}
        startTime={labelToSeconds(startLabel)}
        onSeek={onSeek}
      />
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}
