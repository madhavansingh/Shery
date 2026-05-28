import { parseTimestamps } from './TimestampChip';
import AppIcon from './AppIcon';

/* ════════════════════════════════════════════════════════════════
   INLINE FORMATTER  –  **bold**, `code`, *italic*
   ════════════════════════════════════════════════════════════════ */
function inlineFormat(text, keyPrefix) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-${match.index}`} className="font-bold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={`${keyPrefix}-${match.index}`} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-sky-300">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(
        <em key={`${keyPrefix}-${match.index}`} className="not-italic text-amber-300 font-medium">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ════════════════════════════════════════════════════════════════
   MARKDOWN RENDERER  –  used for notes/quiz "content" & fallback
   ════════════════════════════════════════════════════════════════ */
function renderMarkdown(text, onSeek) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3) || 'code';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      elements.push(
        <div key={`code-${index}`} className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="font-mono text-[11px] text-white/40">{lang}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Code</span>
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-6 text-slate-200">
            <code>{code.join('\n')}</code>
          </pre>
        </div>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="mb-1.5 mt-4 text-[13px] font-bold text-white">
          {inlineFormat(trimmed.slice(4), `h3-${index}`)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index}`} className="mb-2 mt-5 border-b border-accent/20 pb-1.5 text-sm font-extrabold text-accent">
          {inlineFormat(trimmed.slice(3), `h2-${index}`)}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = [];
      while (index < lines.length && /^[-*]\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      elements.push(
        <ul key={`ul-${index}`} className="my-2 flex flex-col gap-1.5 pl-1">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2 text-[13px] leading-6 text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{parseTimestamps(item, onSeek).map((part, partIndex) => (typeof part === 'string' ? inlineFormat(part, `uli-${index}-${itemIndex}-${partIndex}`) : part))}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s/, ''));
        index += 1;
      }
      elements.push(
        <ol key={`ol-${index}`} className="my-2 flex flex-col gap-1.5 pl-1">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex items-start gap-2 text-[13px] leading-6 text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">{itemIndex + 1}</span>
              <span>{parseTimestamps(item, onSeek).map((part, partIndex) => (typeof part === 'string' ? inlineFormat(part, `oli-${index}-${itemIndex}-${partIndex}`) : part))}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (trimmed === '') {
      elements.push(<div key={`sp-${index}`} className="h-1.5" />);
    } else {
      elements.push(
        <p key={`p-${index}`} className="mb-1 text-[13px] leading-7 text-slate-300">
          {parseTimestamps(line, onSeek).map((part, partIndex) =>
            typeof part === 'string' ? inlineFormat(part, `p-${index}-${partIndex}`) : part
          )}
        </p>
      );
    }
    index += 1;
  }

  return elements;
}

/* ════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════════ */

/* ── Confidence badge ─────────────────────────────────────────── */
const CONFIDENCE = {
  high:   { dot: 'bg-emerald-400', pill: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300', label: 'High confidence' },
  medium: { dot: 'bg-amber-400',   pill: 'border-amber-500/25 bg-amber-500/10 text-amber-300',       label: 'Medium confidence' },
  low:    { dot: 'bg-red-400',     pill: 'border-red-500/25 bg-red-500/10 text-red-300',             label: 'Low confidence' },
};

function ConfidenceBadge({ level }) {
  const cfg = CONFIDENCE[level] || CONFIDENCE.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/* ── Timestamp jump chips ─────────────────────────────────────── */
function TimestampChips({ timestamps, onSeek }) {
  if (!timestamps?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {timestamps.map((ts, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSeek?.(ts.seconds)}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent transition-all hover:bg-accent/20 hover:border-accent/50"
        >
          <AppIcon name="play" size={9} />
          {ts.display}
        </button>
      ))}
    </div>
  );
}

/* ── Key takeaway strip ───────────────────────────────────────── */
function KeyTakeaway({ text }) {
  if (!text) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-3.5 py-2.5">
      <AppIcon name="lightbulb" size={14} className="mt-0.5 shrink-0 text-amber-400" />
      <p className="text-[12px] font-medium leading-5 text-amber-200">{text}</p>
    </div>
  );
}

/* ── Not-covered notice ───────────────────────────────────────── */
function NotCoveredNotice({ text }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-600/30 bg-slate-700/20 px-4 py-3">
      <AppIcon name="alert" size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <p className="text-[13px] leading-6 text-slate-300">{text}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ANSWER CARD  –  type: "answer"
   ════════════════════════════════════════════════════════════════ */
function AnswerCard({ data, onSeek }) {
  if (data.notCovered) return <NotCoveredNotice text={data.answer} />;

  return (
    <div className="flex flex-col gap-0">
      {/* Confidence badge row */}
      {data.confidence && (
        <div className="mb-2.5">
          <ConfidenceBadge level={data.confidence} />
        </div>
      )}

      {/* Main answer body */}
      <div className="text-[13px] leading-[1.8] text-slate-200">
        {parseTimestamps(data.answer || '', onSeek).map((part, i) =>
          typeof part === 'string' ? inlineFormat(part, `ans-${i}`) : part
        )}
      </div>

      {/* Timestamp jump buttons */}
      <TimestampChips timestamps={data.timestamps} onSeek={onSeek} />

      {/* Key takeaway */}
      <KeyTakeaway text={data.keyTakeaway} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   NOTES CARD  –  type: "notes"
   ════════════════════════════════════════════════════════════════ */
function NotesCard({ data, onSeek }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Topic label */}
      {data.overallTopic && (
        <div className="flex items-center gap-2">
          <AppIcon name="book" size={13} className="text-accent" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
            {data.overallTopic}
          </span>
        </div>
      )}

      {/* Summary text */}
      {data.summaryText && (
        <p className="text-[13px] leading-[1.75] text-slate-300">{data.summaryText}</p>
      )}

      {/* Key points list */}
      {data.keyPoints?.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Key Points</p>
          {data.keyPoints.map((kp, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 hover:bg-white/[0.05] transition-colors"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[1.6] text-slate-100">{kp.text}</p>
                {kp.timestampRange && (
                  <button
                    type="button"
                    onClick={() => onSeek?.(kp.start)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                  >
                    <AppIcon name="play" size={9} />
                    {kp.timestampRange}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Takeaway */}
      <KeyTakeaway text={data.keyTakeaway} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   QUIZ CARD  –  type: "quiz"
   ════════════════════════════════════════════════════════════════ */
function QuizCard({ data }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AppIcon name="brain" size={13} className="text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Quiz</span>
      </div>
      {data.questions?.map((q, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          {/* Question */}
          <p className="mb-3 text-[13px] font-semibold leading-[1.6] text-white">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 font-mono text-[10px] font-bold text-accent">{i + 1}</span>
            {q.question}
          </p>
          {/* Options */}
          <div className="flex flex-col gap-1.5">
            {q.options?.map((opt, j) => {
              const letter = opt.charAt(0);
              const isCorrect = letter === q.answer;
              return (
                <div
                  key={j}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-[12px] leading-5 transition-colors ${
                    isCorrect
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 font-semibold'
                      : 'border border-transparent text-slate-400'
                  }`}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                    {letter}
                  </span>
                  {opt.slice(2).trim()}
                  {isCorrect && <AppIcon name="checkCircle" size={12} className="ml-auto shrink-0 text-emerald-400" />}
                </div>
              );
            })}
          </div>
          {/* Explanation */}
          {q.explanation && (
            <div className="mt-2.5 flex items-start gap-2 border-t border-white/[0.06] pt-2.5">
              <AppIcon name="lightbulb" size={12} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-[11px] leading-5 text-slate-400">{q.explanation}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SUMMARY CARD  –  type: "summary"  (initial load)
   ════════════════════════════════════════════════════════════════ */
function SummaryCard({ data, onSeek }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Topic + reading time */}
      <div className="flex items-center justify-between">
        {data.overallTopic && (
          <div className="flex items-center gap-1.5">
            <AppIcon name="sparkles" size={13} className="text-accent" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">{data.overallTopic}</span>
          </div>
        )}
        {data.estimatedReadingTime && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <AppIcon name="clock" size={10} />
            {data.estimatedReadingTime} read
          </span>
        )}
      </div>

      {/* Summary text */}
      {data.summaryText && (
        <p className="text-[13px] leading-[1.75] text-slate-300">{data.summaryText}</p>
      )}

      {/* Key points */}
      {data.keyPoints?.length > 0 && (
        <div className="flex flex-col gap-2 mt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Key Points</p>
          {data.keyPoints.map((kp, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[1.6] text-slate-100">{kp.text}</p>
                {kp.timestampRange && (
                  <button type="button" onClick={() => onSeek?.(kp.start)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                    <AppIcon name="play" size={9} />{kp.timestampRange}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested questions */}
      {data.suggestedQuestions?.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ask me about…</p>
          {data.suggestedQuestions.map((q, i) => (
            <button key={i} type="button" className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left text-[12px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white">
              <AppIcon name="arrowRight" size={11} className="shrink-0 text-accent" />
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   JSON PARSER  –  3-strategy robust extractor
   1. Direct JSON parse (model output is clean)
   2. Strip markdown ```json ... ``` fences
   3. Regex scan — find first { ... } block anywhere in text
   ════════════════════════════════════════════════════════════════ */
function parseAiContent(content) {
  if (!content) return null;
  const trimmed = content.trim();

  // Strategy 1: whole string is valid JSON
  if (trimmed.startsWith('{')) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }

  // Strategy 2: model wrapped JSON in ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }

  // Strategy 3: JSON object buried anywhere in the text (handle preamble/suffix)
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd   = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try { return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)); } catch { /* not valid JSON */ }
  }

  return null;
}

/* ════════════════════════════════════════════════════════════════
   AI RESPONSE ROUTER
   ════════════════════════════════════════════════════════════════ */
function AiResponseRenderer({ data, onSeek }) {
  if (!data) return null;
  if (data.type === 'answer')  return <AnswerCard  data={data} onSeek={onSeek} />;
  if (data.type === 'notes')   return <NotesCard   data={data} onSeek={onSeek} />;
  if (data.type === 'quiz')    return <QuizCard    data={data} />;
  if (data.type === 'summary') return <SummaryCard data={data} onSeek={onSeek} />;
  // Legacy / unknown type — render whatever text field exists
  const fallback = data.summaryText || data.content || data.answer || '';
  return <div className="break-words">{renderMarkdown(fallback, onSeek)}</div>;
}

/* ════════════════════════════════════════════════════════════════
   STREAMING VIEW  –  hides raw JSON, shows skeleton while building
   ════════════════════════════════════════════════════════════════ */
function StreamingView({ text, onSeek }) {
  const trimmed = text?.trim() || '';

  // If the stream looks like JSON (starts with {), hide the raw text
  // and show a subtle pulsing placeholder so the user sees activity
  if (trimmed.startsWith('{')) {
    // Try to render if it's already complete
    if (trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return <AiResponseRenderer data={parsed} onSeek={onSeek} />;
      } catch { /* still incomplete — fall to skeleton */ }
    }
    // Still streaming JSON — show loading skeleton
    return (
      <div className="flex flex-col gap-2.5 py-1">
        <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-white/10" />
        <div className="h-2.5 w-full animate-pulse rounded-full bg-white/10" />
        <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-white/10" />
        <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  // Plain text stream (shouldn't happen with strict JSON mode, but safe fallback)
  return <div className="break-words text-[13px] leading-7 text-slate-300">{renderMarkdown(trimmed, onSeek)}</div>;
}

/* ════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════════════════════════════════ */
export default function ChatMessage({ message, onSeek, isStreaming = false }) {
  const isUser = message.role === 'user';
  const parsed = !isUser ? parseAiContent(message.content) : null;

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <AppIcon name="sparkles" size={15} />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[84%] rounded-2xl border px-4 py-3 ${
          isUser
            ? 'rounded-br bg-accent text-white border-accent text-sm'
            : 'rounded-bl bg-surface-card text-slate-200 border-line'
        }`}
      >
        {isUser ? (
          <span className="text-sm leading-6">{message.content}</span>
        ) : isStreaming ? (
          <StreamingView text={message.content} onSeek={onSeek} />
        ) : parsed ? (
          <AiResponseRenderer data={parsed} onSeek={onSeek} />
        ) : (
          <div className="break-words">{renderMarkdown(message.content, onSeek)}</div>
        )}

        {/* Blinking cursor while streaming */}
        {isStreaming && (
          <span className="ml-1 inline-block h-4 w-2 animate-blink rounded-sm bg-accent align-middle" />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-white">
          <AppIcon name="user" size={15} />
        </div>
      )}
    </div>
  );
}
