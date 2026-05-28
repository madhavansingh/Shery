import { useState, useRef, useEffect } from 'react';
import AppIcon from '../AppIcon';
import WorkspaceChatMessage from './WorkspaceChatMessage';
import ChatModeSelector from './ChatModeSelector';

const THINKING_STAGES = [
  { icon: 'search', label: 'Searching knowledge vectors...' },
  { icon: 'filter', label: 'Reranking by semantic relevance...' },
  { icon: 'layers', label: 'Assembling grounded context...' },
  { icon: 'bot', label: 'Synthesizing expert response...' },
];

const EMPTY_STATE_SUGGESTIONS = [
  'What are the core concepts covered in my sources?',
  'Explain the main architecture described here.',
  'What are the key takeaways from these materials?',
  'Compare the different approaches mentioned.',
];

export default function ChatPanel({
  messages = [],
  isStreaming,
  currentStreamText,
  sources = [],
  error,
  mode,
  onSelectMode,
  onSendMessage,
  onStopStreaming,
  onClearSession,
  onSelectCitation,
  workspaceSources = [],
}) {
  const [input, setInput] = useState('');
  const [thinkingStage, setThinkingStage] = useState(0);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const hasDegradedSources = workspaceSources.some(s =>
    ['ready_without_vectors', 'indexing_pending', 'indexing_retrying'].includes(s.status)
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamText]);

  // Progressive thinking stage animation
  useEffect(() => {
    if (isStreaming && !currentStreamText) {
      setThinkingStage(0);
      const timers = THINKING_STAGES.map((_, i) =>
        setTimeout(() => setThinkingStage(i), i * 900)
      );
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [isStreaming, currentStreamText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (q) => {
    if (!isStreaming) {
      onSendMessage(q);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#030305] relative overflow-hidden">
      {/* Panel Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#06070a]/40 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          {/* Live indicator */}
          <div className="relative w-2 h-2 shrink-0">
            <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-45" />
            <div className="relative w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-100">Knowledge Workspace Tutor</span>
          {hasDegradedSources ? (
            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AppIcon name="alert" size={8} />
              <span>BM25 Fallback</span>
            </span>
          ) : workspaceSources.length > 0 ? (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AppIcon name="check" size={8} />
              <span>Fully Grounded</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <ChatModeSelector activeMode={mode} onSelectMode={onSelectMode} />
          <button
            onClick={onClearSession}
            className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/5 rounded-xl transition cursor-pointer"
            title="Clear Chat"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Degraded Sources Warning Banner */}
      {hasDegradedSources && (
        <div className="bg-amber-950/10 border-b border-amber-900/15 px-6 py-2.5 flex items-center gap-2.5 text-[10px] text-amber-450 font-semibold select-none shrink-0">
          <AppIcon name="alert" size={11} className="text-amber-550 shrink-0" />
          <span>
            Some sources are still indexing. Responses use BM25 keyword matching until vector indexing completes.
          </span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 relative">
        <div className="max-w-3xl mx-auto w-full px-6 py-6 space-y-8">

          {/* Empty state */}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center select-none">
              {/* Icon */}
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-lg shadow-indigo-950/20">
                  <AppIcon name="bot" size={26} className="text-indigo-400 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-100 mb-1.5">Ask your knowledge base</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mb-8">
                Ask any question about your uploaded sources. The AI will synthesize grounded responses with citations.
              </p>

              {/* Suggestion chips */}
              {workspaceSources.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {EMPTY_STATE_SUGGESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(q)}
                      className="text-[10px] font-semibold text-slate-400 hover:text-indigo-300 bg-white/[0.015] hover:bg-indigo-500/5 border border-white/5 hover:border-indigo-500/20 rounded-xl px-3.5 py-2 transition-all duration-200 text-left cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <WorkspaceChatMessage
              key={msg.id}
              message={msg}
              onSelectCitation={onSelectCitation}
              onSendMessage={!isStreaming ? onSendMessage : undefined}
            />
          ))}

          {/* AI Thinking State */}
          {isStreaming && !currentStreamText && (
            <div className="flex gap-3.5 justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent animate-pulse" />
                <AppIcon name="bot" size={13} className="text-indigo-400 relative z-10" />
              </div>
              <div className="bg-white/[0.012] border border-white/5 rounded-2xl rounded-tl-sm p-4 space-y-3 min-w-[240px] shadow-md">
                {THINKING_STAGES.map((stage, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 text-[10px] font-semibold transition-all duration-300 ${
                      i === thinkingStage
                        ? 'text-indigo-300'
                        : i < thinkingStage
                        ? 'text-slate-500'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                      i === thinkingStage
                        ? 'bg-indigo-400 animate-ping'
                        : i < thinkingStage
                        ? 'bg-slate-650'
                        : 'bg-white/[0.03]'
                    }`} />
                    {stage.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Streaming message bubble */}
          {isStreaming && currentStreamText && (
            <WorkspaceChatMessage
              message={{
                role: 'assistant',
                content: currentStreamText,
                sources,
              }}
              isStreaming
              onSelectCitation={onSelectCitation}
            />
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2.5 p-4 bg-rose-950/15 border border-rose-900/20 rounded-2xl text-[11px] text-rose-455 max-w-xl">
              <AppIcon name="alert" size={14} className="shrink-0 mt-0.5 text-rose-500" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Flex Input Container */}
      <div className="border-t border-white/5 bg-[#030305] px-6 py-4 shrink-0 z-10">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative bg-[#06070a]/90 border border-white/5 rounded-2xl focus-within:border-indigo-500/25 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.05)] transition-all duration-300 backdrop-blur-md">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask anything in ${mode.replace('_', ' ')} mode…`}
                rows={1}
                className="w-full bg-transparent pl-4 pr-14 py-4 text-[12px] text-slate-100 placeholder-slate-600 focus:outline-none resize-none max-h-[120px] scrollbar-none leading-relaxed"
              />

              {/* Send / Stop button */}
              <div className="absolute right-3.5 bottom-3.5">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopStreaming}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-950/30 border border-rose-900/30 text-rose-400 hover:bg-rose-900/25 transition cursor-pointer"
                    title="Stop"
                  >
                    <AppIcon name="square" size={9} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 disabled:bg-white/[0.02] disabled:text-slate-600 text-white hover:bg-indigo-700 transition disabled:cursor-not-allowed shadow-md cursor-pointer"
                  >
                    <AppIcon name="send" size={11} />
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="flex items-center justify-between mt-2 px-1 text-[9px] text-slate-600 font-semibold select-none">
            <span>↵ Send · Shift+↵ New line</span>
            <span>Grounded strictly from your sources</span>
          </div>
        </div>
      </div>
    </div>
  );
}
