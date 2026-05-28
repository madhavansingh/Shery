import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppIcon from '../components/AppIcon';
import { useGenerateQuizMutation } from '../api/lessonQueries';
import ProgressSummary, { ProgressTrack } from '../components/ProgressSummary';

const TIMER_SECS = 30;

function fmtTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function ConfigScreen({ onStart }) {
  const [count, setCount] = useState(10);
  const [diff, setDiff] = useState('mixed');

  return (
    <main className="flex min-h-screenNav items-center justify-center px-6 py-10">
      <section className="w-full max-w-[480px] rounded-3xl border border-line bg-surface-card p-9 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-8 text-center">
          <AppIcon name="brain" size={52} strokeWidth={1.8} className="mb-3 text-accent" />
          <h1 className="mb-1.5 text-[26px] font-extrabold text-white">AI Quiz</h1>
          <p className="text-sm text-muted">Questions generated from this video lecture</p>
        </div>

        <OptionGroup title="Number of Questions">
          {[5, 10, 15].map((value) => (
            <Chip key={value} active={count === value} onClick={() => setCount(value)}>
              {value}
            </Chip>
          ))}
        </OptionGroup>

        <OptionGroup title="Difficulty">
          {[
            ['mixed', 'circleDot', 'Mixed'],
            ['easy', 'checkCircle', 'Easy'],
            ['medium', 'target', 'Medium'],
            ['hard', 'alert', 'Hard'],
          ].map(([value, icon, label]) => (
            <Chip key={value} active={diff === value} onClick={() => setDiff(value)} className="basis-[calc(50%-4px)]">
              <AppIcon name={icon} size={14} /> {label}
            </Chip>
          ))}
        </OptionGroup>

        <button type="button" onClick={() => onStart(count, diff)} className="w-full rounded-[14px] bg-accent px-4 py-3.5 text-[15px] font-bold text-white">
          Start Quiz
        </button>
      </section>
    </main>
  );
}

function OptionGroup({ title, children }) {
  return (
    <section className="mb-6">
      <p className="mb-2.5 text-[13px] font-semibold uppercase text-muted-text">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-5 py-2 text-[13px] font-semibold transition ${
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface-card2 text-muted-text'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function TimerRing({ seconds, total }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const pct = seconds / total;
  const color = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="44" height="44" className="-rotate-90">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
      />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fill={color} fontSize="11" fontWeight="700" className="rotate-90 origin-center">
        {seconds}
      </text>
    </svg>
  );
}

function difficultyClass(difficulty) {
  if (difficulty === 'easy') return 'bg-green-500/10 text-green-400';
  if (difficulty === 'hard') return 'bg-red-500/10 text-red-400';
  return 'bg-amber-500/10 text-amber-400';
}

function QuestionCard({ q, idx, total, score, streak, timeLeft, selected, revealed, onChoose, onConfirm, onNext }) {
  const letter = (option) => option.charAt(0);
  const progress = Math.round((idx / total) * 100);

  return (
    <section className="mx-auto w-full max-w-[620px] px-4">
      <header className="mb-5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">
          Q{idx + 1} / {total}
        </span>
        <div className="flex items-center gap-3">
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 text-[13px] font-bold text-orange-500">
              <AppIcon name="flame" size={14} />
              {streak} streak
            </span>
          )}
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">{score} pts</span>
          <TimerRing seconds={timeLeft} total={TIMER_SECS} />
        </div>
      </header>

      <ProgressTrack value={progress} height="h-1" className="mb-6" />

      <article className="overflow-hidden rounded-[20px] border border-line bg-surface-card shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <div className="px-7 pb-2 pt-6">
          <div className="mb-4 flex gap-2">
            {q.difficulty && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${difficultyClass(q.difficulty)}`}>{q.difficulty}</span>}
            {q.topic && <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-muted">{q.topic}</span>}
          </div>
          <h2 className="mb-[22px] text-lg font-bold leading-7 text-white">{q.question}</h2>
        </div>

        <div className="flex flex-col gap-2.5 px-7 pb-5">
          {q.options.map((option, index) => {
            const l = letter(option);
            const isRight = revealed && l === q.answer;
            const isWrong = revealed && selected === option && l !== q.answer;
            const isSel = !revealed && selected === option;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onChoose(option)}
                className={`flex items-center gap-3 rounded-[13px] border px-4 py-[13px] text-left text-sm font-medium transition ${
                  isRight
                    ? 'border-green-500/50 bg-green-500/10 text-green-200'
                    : isWrong
                      ? 'border-red-500/50 bg-red-500/10 text-red-200'
                      : isSel
                        ? 'border-accent-border bg-accent-soft text-white'
                        : 'border-line bg-surface-card2 text-white hover:border-accent-border'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    isRight
                      ? 'bg-green-500/20 text-green-200'
                      : isWrong
                        ? 'bg-red-500/20 text-red-200'
                        : isSel
                          ? 'bg-accent/15 text-accent'
                          : 'bg-white/5 text-muted'
                  }`}
                >
                  {isRight ? <AppIcon name="check" size={14} /> : isWrong ? <AppIcon name="x" size={14} /> : l}
                </span>
                {option.substring(3)}
              </button>
            );
          })}
        </div>

        {revealed && q.explanation && (
          <div className="mx-7 mb-5 rounded-[13px] border border-accent-border bg-accent-soft px-4 py-3.5">
            <p className="mb-1.5 text-[13px] leading-6 text-accent">
              <AppIcon name="lightbulb" size={14} /> <strong>Why?</strong> {q.explanation}
            </p>
            {q.startLabel && (
              <p className="text-xs text-muted">
                <AppIcon name="target" size={13} /> Covered at <span className="font-mono text-accent">{q.startLabel}</span> in the lecture
              </p>
            )}
          </div>
        )}

        <div className="px-7 pb-6">
          {!revealed ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!selected}
              className="w-full rounded-[13px] bg-accent px-4 py-[13px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
            >
              Check Answer
            </button>
          ) : (
            <button type="button" onClick={onNext} className="w-full rounded-[13px] bg-accent px-4 py-[13px] text-[15px] font-bold text-white">
              {idx + 1 >= total ? (
                <>
                  <AppIcon name="trophy" size={15} /> See Results
                </>
              ) : (
                'Next Question'
              )}
            </button>
          )}
        </div>
      </article>
    </section>
  );
}

function ResultsScreen({ quiz, answers, score, totalTime, onRestart, lessonId }) {
  const [tab, setTab] = useState('overview');
  const correct = answers.filter((answer) => answer.correct).length;
  const pct = Math.round((score / (quiz.length * 10)) * 100);
  const grade = pct >= 80 ? 'trophy' : pct >= 60 ? 'target' : 'book';
  const msg = pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good effort!' : 'Keep studying!';

  return (
    <main className="mx-auto max-w-[620px] px-4 py-10">
      <section className="mb-4 rounded-3xl border border-line bg-surface-card p-9 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <AppIcon name={grade} size={60} strokeWidth={1.8} className="mb-3 text-accent" />
        <h1 className="mb-1 text-[32px] font-black text-white">
          {correct}/{quiz.length}
        </h1>
        <p className="mb-6 text-[15px] text-muted">{msg}</p>
        <ProgressSummary
          percent={pct}
          title={`${pct}% Accuracy`}
          stats={[
            { label: 'Correct', value: `${correct}/${quiz.length}` },
            { label: 'Score', value: `${score} pts` },
            { label: 'Time', value: fmtTime(totalTime) },
          ]}
          className="bg-surface-nav text-left"
        />
      </section>

      <div className="mb-4 flex gap-1 rounded-full border border-line bg-surface-card p-1">
        {['overview', 'review'].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-[18px] py-2 text-[13px] font-semibold capitalize ${tab === value ? 'bg-accent text-white' : 'text-muted'}`}
          >
            {value === 'review' ? 'Review Answers' : 'Overview'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {answers.map((answer, index) => (
          <article key={index} className={`rounded-2xl border bg-surface-card ${answer.correct ? 'border-green-500/20' : 'border-red-500/20'}`}>
            <header className="border-b border-line px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <AppIcon name={answer.correct ? 'checkCircle' : 'xCircle'} size={14} />
                Q{index + 1}: {answer.question}
              </p>
            </header>
            {tab === 'review' && (
              <div className={`px-4 py-3 ${answer.correct ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                {!answer.correct && <p className="mb-1.5 text-xs text-red-200">Your answer: {answer.selected}</p>}
                <p className="mb-1.5 text-xs text-green-200">
                  <AppIcon name="check" size={13} /> Correct: {answer.answer}
                </p>
                {answer.explanation && (
                  <p className="mb-1.5 text-xs leading-6 text-muted-text">
                    <AppIcon name="lightbulb" size={13} /> {answer.explanation}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={onRestart} className="flex flex-1 items-center justify-center gap-1.5 rounded-[13px] bg-accent px-4 py-[13px] text-sm font-bold text-white">
          <AppIcon name="refresh" size={14} /> Try Again
        </button>
        <Link to={`/lesson/${lessonId}`} className="flex flex-1 items-center justify-center rounded-[13px] border border-line bg-surface-card px-4 py-[13px] text-sm font-semibold text-white">
          Back to Lesson
        </Link>
      </div>
    </main>
  );
}

export default function QuizPage() {
  const { lessonId } = useParams();
  const [phase, setPhase] = useState('config');
  const [quiz, setQuiz] = useState([]);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECS);
  const [totalTime, setTotalTime] = useState(0);
  const timerRef = useRef(null);
  const totalRef = useRef(null);
  const generateQuizMutation = useGenerateQuizMutation();

  const clearTimers = () => {
    clearInterval(timerRef.current);
    clearInterval(totalRef.current);
  };

  const handleTimeout = useCallback(() => {
    const q = quiz[current];
    if (!q) return;
    setAnswers((items) => [...items, { question: q.question, selected: 'Timed out', correct: false, answer: q.answer, explanation: q.explanation }]);
    setStreak(0);
    setRevealed(true);
  }, [quiz, current]);

  const startTimers = useCallback(() => {
    setTimeLeft(TIMER_SECS);
    timerRef.current = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, [handleTimeout]);

  useEffect(() => () => clearTimers(), []);

  const startQuiz = async (count, difficulty) => {
    setPhase('loading');
    setError(null);
    try {
      const data = await generateQuizMutation.mutateAsync({ lessonId, count, type: 'mcq', difficulty });
      setQuiz(data.questions || []);
      setCurrent(0);
      setSelected(null);
      setRevealed(false);
      setScore(0);
      setStreak(0);
      setAnswers([]);
      setTotalTime(0);
      setPhase('quiz');
      startTimers();
      totalRef.current = setInterval(() => setTotalTime((time) => time + 1), 1000);
    } catch (err) {
      setError(err.message);
      setPhase('config');
    }
  };

  const confirmAnswer = () => {
    if (!selected || revealed) return;
    clearInterval(timerRef.current);
    const q = quiz[current];
    const correct = selected.charAt(0) === q.answer;
    const pts = correct ? (timeLeft > 20 ? 15 : timeLeft > 10 ? 10 : 5) : 0;
    if (correct) {
      setScore((value) => value + pts);
      setStreak((value) => value + 1);
    } else {
      setStreak(0);
    }
    const answerLabel = q.options.find((option) => option.charAt(0) === q.answer) || q.answer;
    setAnswers((items) => [
      ...items,
      { question: q.question, selected, correct, answer: answerLabel, explanation: q.explanation, difficulty: q.difficulty, topic: q.topic, startLabel: q.startLabel },
    ]);
    setRevealed(true);
  };

  const next = () => {
    if (current + 1 >= quiz.length) {
      clearTimers();
      setPhase('results');
      return;
    }
    setCurrent((value) => value + 1);
    setSelected(null);
    setRevealed(false);
    startTimers();
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <Navbar />
      <Link
        to={`/lesson/${lessonId}`}
        aria-label="Close quiz"
        title="Close quiz"
        className="fixed right-4 top-[72px] z-40 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-card text-white shadow-xl transition hover:border-accent-border hover:bg-surface-hover"
      >
        <AppIcon name="x" size={18} />
      </Link>

      {phase === 'config' && (
        <>
          {error && (
            <div className="mx-auto mt-4 max-w-[500px] rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
              <AppIcon name="alert" size={14} /> {error}
            </div>
          )}
          <ConfigScreen onStart={startQuiz} />
        </>
      )}

      {phase === 'loading' && (
        <main className="flex h-screenNav flex-col items-center justify-center gap-4">
          <AppIcon name="loader" size={52} className="animate-spin text-accent" />
          <p className="text-sm text-muted">Generating your personalised quiz...</p>
        </main>
      )}

      {phase === 'quiz' && quiz[current] && (
        <main className="py-8">
          <QuestionCard
            q={quiz[current]}
            idx={current}
            total={quiz.length}
            score={score}
            streak={streak}
            timeLeft={timeLeft}
            selected={selected}
            revealed={revealed}
            onChoose={(option) => !revealed && setSelected(option)}
            onConfirm={confirmAnswer}
            onNext={next}
          />
        </main>
      )}

      {phase === 'results' && (
        <ResultsScreen quiz={quiz} answers={answers} score={score} totalTime={totalTime} onRestart={() => setPhase('config')} lessonId={lessonId} />
      )}
    </div>
  );
}
