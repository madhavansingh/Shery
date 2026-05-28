import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import ChatMessage from './ChatMessage';
import AppIcon from './AppIcon';


const starterFallback = [
  'Summarize this lecture',
  'What are the key ideas?',
  'Quiz me on this topic',
  'Explain the hardest concept simply',
];

import SummaryPdfModal from './SummaryPdfModal';

export default function ChatPanel({ lessonId, lesson, onSeek, getVideoTime }) {
  const { messages, isStreaming, currentStreamText, followUps, error, sendMessage, stopStreaming, clearSession } = useChat(lessonId);
  const [input, setInput] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamText]);

  const handleSend = (text = input) => {
    const message = (typeof text === 'string' ? text : input).trim();
    if (!message || isStreaming) return;
    setInput('');
    sendMessage(message, typeof getVideoTime === 'function' ? getVideoTime : () => 0);
  };

  const starters = lesson?.starterQuestions?.length ? lesson.starterQuestions : starterFallback;
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-base font-sans">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-[18px] sm:py-3.5">
        <div className="min-w-0">
          <h3 className="flex min-w-0 items-center gap-2 truncate text-[15px] font-bold text-slate-100">
            <AppIcon name="bot" size={18} /> AI Tutor
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-600">Ask anything about this lecture</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setShowSummary(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-xs font-medium text-muted-text sm:px-3">
            <AppIcon name="file" size={14} /> Summary
          </button>
          {hasMessages && (
            <button type="button" onClick={clearSession} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-xs font-medium text-red-400 sm:px-3">
              <AppIcon name="trash" size={14} /> Clear
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-surface-base px-3 py-3.5 sm:px-3.5 sm:py-4">
        {!hasMessages && (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-3 sm:gap-5 sm:p-6">
            <div className="text-center">
              <AppIcon name="bot" size={48} strokeWidth={1.8} className="mb-3 text-accent" />
              <h4 className="mb-1.5 text-base font-bold text-white">Your AI Tutor</h4>
              <p className="text-[13px] leading-6 text-muted">Ask anything about this lecture. Answers include timestamps when available.</p>
            </div>
            <div className="w-full">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">Try asking</p>
              <div className="flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-1">
                {starters.map((question, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSend(question)}
                    className="rounded-xl border border-line bg-surface-card px-3.5 py-2 text-left text-[13px] leading-5 text-muted-text transition hover:bg-surface-hover hover:text-white"
                  >
                    <AppIcon name="message" size={13} /> {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} onSeek={onSeek} />
        ))}

        {isStreaming && currentStreamText && (
          <ChatMessage message={{ role: 'assistant', content: currentStreamText, id: 'streaming' }} onSeek={onSeek} isStreaming />
        )}

        {isStreaming && !currentStreamText && (
          <div className="flex items-center gap-2.5 py-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <AppIcon name="bot" size={15} />
            </div>
            <div className="flex gap-1.5 rounded-bl rounded-br-2xl rounded-tr-2xl border border-line bg-surface-card px-4 py-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-[7px] w-[7px] animate-bounceDots rounded-full bg-accent" />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-400">
            <AppIcon name="alert" size={14} /> {error}
          </div>
        )}

        {followUps.length > 0 && !isStreaming && (
          <div className="pl-10">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Follow-up questions</p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((question, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSend(question)}
                  className="whitespace-nowrap rounded-full border border-accent-border bg-accent/5 px-3.5 py-1.5 text-xs font-medium text-accent transition hover:-translate-y-px hover:bg-accent-soft"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="shrink-0 border-t border-line bg-surface-nav px-3 py-2.5 sm:px-3.5 sm:py-3">
        <div className="flex items-end gap-2 rounded-[14px] border border-line bg-surface-input px-3 py-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about any part of this lecture..."
            rows={1}
            className="max-h-[96px] min-h-9 flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm leading-6 text-white outline-none"
          />
          <button
            type="button"
            onClick={isStreaming ? stopStreaming : handleSend}
            disabled={!isStreaming && !input.trim()}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isStreaming ? 'bg-red-500/20 text-red-400' : 'bg-accent'
            }`}
          >
            <AppIcon name={isStreaming ? 'square' : 'send'} size={15} />
          </button>
        </div>
        <p className="mt-1.5 hidden text-center text-[11px] text-muted sm:block">Enter to send. Shift+Enter for new line.</p>
      </footer>

      {showSummary && <SummaryPdfModal lessonId={lessonId} lessonTitle={lesson?.title} onClose={() => setShowSummary(false)} />}
    </div>
  );
}
