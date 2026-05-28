import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useLessonsQuery } from '../api/lessonQueries';
import Navbar from '../components/Navbar';
import AppIcon from '../components/AppIcon';
import ProgressSummary from '../components/ProgressSummary';

const DEMO_COURSE = 'demo-course-001';

function HeatMap({ lessons }) {
  const cells = 80;
  const readyCount = lessons.filter((lesson) => lesson.status === 'ready').length;
  const active = Math.min(readyCount * 8, cells);

  const cellClass = (index) => {
    if (index >= active) return 'bg-white/[0.06]';
    if (index < active * 0.3) return 'bg-accent/30';
    if (index < active * 0.6) return 'bg-accent/60';
    if (index < active * 0.85) return 'bg-accent/85';
    return 'bg-accent';
  };

  return (
    <div>
      <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: cells }).map((_, index) => (
          <div key={index} className={`aspect-square rounded-[3px] ${cellClass(index)}`} />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] text-muted">Less</span>
        <div className="flex gap-[3px]">
          {['bg-accent/15', 'bg-accent/35', 'bg-accent/60', 'bg-accent/85', 'bg-accent'].map((color) => (
            <div key={color} className={`h-3 w-3 rounded-sm ${color}`} />
          ))}
        </div>
        <span className="text-[11px] text-muted">More</span>
      </div>
    </div>
  );
}

function LessonRow({ lesson, index, isNewest }) {
  const navigate = useNavigate();
  const isReady = lesson.status === 'ready';

  return (
    <div
      role="button"
      tabIndex={isReady ? 0 : -1}
      onClick={() => isReady && navigate(`/lesson/${lesson.id}`)}
      onKeyDown={(event) => event.key === 'Enter' && isReady && navigate(`/lesson/${lesson.id}`)}
      className={`group flex items-center gap-3 rounded-lg px-4 py-[11px] transition ${
        isReady ? 'cursor-pointer hover:bg-surface-hover' : 'cursor-default'
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          isReady ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-line bg-white/5 text-muted'
        }`}
      >
        <AppIcon name={isReady ? 'check' : 'play'} size={13} />
      </div>

      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted-text group-hover:text-white">
        {index + 1} - {lesson.title}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {isNewest && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
            Latest
          </span>
        )}
        {lesson.chunkCount > 0 && <span className="text-[11px] text-muted">{lesson.chunkCount} chunks</span>}
        {!isReady && <span className="text-[11px] font-medium text-accent">{lesson.status}</span>}
        {isReady && (
          <div className="flex gap-1.5 text-[11px] font-semibold">
            <Link to={`/lesson/${lesson.id}`} onClick={(event) => event.stopPropagation()} className="text-accent">
              Watch
            </Link>
            <span className="text-line">.</span>
            <Link to={`/lesson/${lesson.id}/quiz`} onClick={(event) => event.stopPropagation()} className="text-muted">
              Quiz
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useLessonsQuery(DEMO_COURSE);
  const lessons = data?.lessons || [];
  const readyLessons = lessons
    .filter((lesson) => lesson.status === 'ready')
    .sort((a, b) => {
      // Sort newest first: compare ISO createdAt strings (lexicographic works for ISO dates)
      const ta = a.createdAt || '';
      const tb = b.createdAt || '';
      return tb.localeCompare(ta);
    });

  const readyCount = readyLessons.length;
  const pct = readyCount > 0 ? 100 : 0;
  const filteredLessons = readyLessons.filter((lesson) => lesson.title?.toLowerCase().includes(search.toLowerCase()));
  const nextLesson = readyLessons[0];

  return (
    <div className="min-h-screen bg-surface-base">
      <Navbar />

      <main className="grid min-h-screenNav grid-cols-1 lg:grid-cols-[1fr_340px]">
        <section className="overflow-y-auto border-r border-line px-8 py-7">
          <div className="mb-6 flex items-center gap-3">
            <Link to="/" className="text-lg leading-none text-muted">
              Back
            </Link>
            <h1 className="text-xl font-bold text-white">AI Learning Companion</h1>
          </div>

          <ProgressSummary
            className="mb-6"
            percent={pct}
            stats={[
              { label: 'Lessons', value: readyCount },
              { label: 'AI Indexed', value: readyCount },
              { label: 'Quizzes', value: `${readyCount} available` },
            ]}
            action={
              nextLesson && (
                <Link to={`/lesson/${nextLesson.id}`} className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white">
                  Resume Learning
                </Link>
              )
            }
          />

          <div className="mb-5 flex gap-1 border-b border-line">
            {[
              ['All Modules', 'book'],
              ['Announcements', 'megaphone'],
            ].map(([tab, icon], index) => (
              <button
                key={tab}
                type="button"
                className={`mb-[-1px] inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-[13px] ${
                  index === 0 ? 'border-accent font-semibold text-white' : 'border-transparent text-muted'
                }`}
              >
                <AppIcon name={icon} size={14} />
                {tab}
              </button>
            ))}
          </div>

          <label className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-input px-3 py-2">
            <AppIcon name="search" size={14} className="text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lessons..."
              className="flex-1 border-none bg-transparent text-[13px] text-white outline-none"
            />
          </label>

          {isLoading ? (
            <div className="p-12 text-center">
              <AppIcon name="loader" size={32} className="animate-spin text-accent" />
            </div>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-line bg-surface-card">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex w-full items-center justify-between border-b border-line px-5 py-4"
              >
                <span className="flex items-center gap-2.5">
                  <AppIcon name="video" size={15} />
                  <span className="text-sm font-bold text-white">Video Lessons</span>
                  {nextLesson && (
                    <Link
                      to={`/lesson/${nextLesson.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      Resume
                    </Link>
                  )}
                </span>
                <span className={`text-muted transition ${expanded ? 'rotate-180' : ''}`}>⌃</span>
              </button>

              {expanded && (
                <div className="p-2">
                  {filteredLessons.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted">
                      {search ? 'No ready lessons found.' : 'No ready lessons yet. Successfully processed videos will appear here.'}
                    </div>
                  ) : (
                    filteredLessons.map((lesson, index) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        index={index}
                        isNewest={index === 0}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          )}
        </section>

        <aside className="flex flex-col gap-5 px-6 py-7">
          <Panel title="All Notifications">
            <div className="px-5 py-10 text-center">
              <AppIcon name="bell" size={36} strokeWidth={1.8} className="mb-2.5 text-muted" />
              <p className="text-[13px] text-muted">No notifications available</p>
              <p className="mt-1 text-[11px] text-muted">You're all caught up. Check back later for updates.</p>
            </div>
          </Panel>

          <Panel title="Progress Heatmap" subtitle={`${readyCount * 8} lessons explored so far!`}>
            <div className="px-[18px] py-4">
              <HeatMap lessons={readyLessons} />
            </div>
          </Panel>

          <section className="rounded-2xl border border-line bg-surface-card px-[18px] py-4">
            <p className="mb-3.5 text-sm font-semibold text-white">Quick Actions</p>
            <div className="flex flex-col gap-2">
              {nextLesson && (
                <ActionLink to={`/lesson/${nextLesson.id}`} icon="play" accent>
                  Continue Learning
                </ActionLink>
              )}
              <ActionLink to="/instructor" icon="mic">
                Instructor Studio
              </ActionLink>
              {nextLesson && (
                <ActionLink to={`/lesson/${nextLesson.id}/quiz`} icon="brain">
                  Take a Quiz
                </ActionLink>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface-card">
      <header className="border-b border-line px-[18px] py-3.5">
        <span className="text-sm font-semibold text-white">{title}</span>
        {subtitle && <p className="mt-0.5 text-xs text-accent">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function ActionLink({ to, icon, accent = false, children }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] ${
        accent
          ? 'border-accent-border bg-accent-soft font-semibold text-accent'
          : 'border-line bg-surface-hover text-muted-text'
      }`}
    >
      <AppIcon name={icon} size={14} />
      {children}
    </Link>
  );
}
