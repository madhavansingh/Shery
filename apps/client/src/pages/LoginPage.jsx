import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';

const ROLES = [
  {
    key: 'student',
    icon: 'graduation',
    title: 'Student',
    desc: 'Watch lessons, use the AI chatbot, take quizzes',
    dest: '/dashboard',
    tone: 'blue',
  },
  {
    key: 'instructor',
    icon: 'mic',
    title: 'Instructor',
    desc: 'Upload videos, manage courses, track ingestion',
    dest: '/instructor',
    tone: 'accent',
  },
];

const toneClasses = {
  blue: {
    icon: 'text-blue-400',
    hover: 'hover:border-blue-400 hover:shadow-[0_12px_40px_rgba(59,130,246,0.14)]',
    pill: 'bg-blue-500/10 text-blue-300',
  },
  accent: {
    icon: 'text-accent',
    hover: 'hover:border-accent hover:shadow-[0_12px_40px_rgba(232,87,42,0.14)]',
    pill: 'bg-accent-soft text-accent',
  },
};

export default function LoginPage() {
  const navigate = useNavigate();

  const pick = (role) => {
    localStorage.setItem('demo_role', role.key);
    navigate(role.dest);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 py-10 font-sans">
      <section className="mb-12 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl font-black text-white">
          S
        </div>
        <div>
          <div className="text-[22px] font-black leading-none text-white">SheryAI</div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted">AI Demo</div>
        </div>
      </section>

      <h1 className="mb-2 text-center text-[28px] font-extrabold text-white">Choose your role</h1>
      <p className="mb-10 text-center text-sm text-muted">This is a demo. No password needed. Pick a role to continue.</p>

      <section className="flex max-w-[600px] flex-wrap justify-center gap-5">
        {ROLES.map((role) => {
          const tone = toneClasses[role.tone];
          return (
            <button
              key={role.key}
              type="button"
              onClick={() => pick(role)}
              className={`max-w-[260px] flex-1 basis-[220px] rounded-2xl border-2 border-line bg-surface-nav p-8 text-left transition hover:-translate-y-1 hover:bg-[#161616] ${tone.hover}`}
            >
              <AppIcon name={role.icon} size={40} strokeWidth={1.8} className={`mb-4 ${tone.icon}`} />
              <div className="mb-2 text-lg font-bold text-white">{role.title}</div>
              <div className="text-[13px] leading-6 text-[#666]">{role.desc}</div>
              <div className={`mt-5 inline-flex rounded-lg px-4 py-2 text-xs font-bold ${tone.pill}`}>
                Enter as {role.title}
              </div>
            </button>
          );
        })}
      </section>

      <p className="mt-10 text-xs text-[#333]">Demo mode. No real data is stored. Role resets on logout.</p>
    </main>
  );
}
