import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppIcon from './AppIcon';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState(localStorage.getItem('demo_role') || 'student');
  const isInstructor = role === 'instructor';

  useEffect(() => {
    const sync = () => setRole(localStorage.getItem('demo_role') || 'student');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const switchRole = () => {
    localStorage.removeItem('demo_role');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <nav className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-line bg-surface-nav px-6">
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-lg font-extrabold text-white">
          S
        </div>
        <div>
          <div className="text-sm font-extrabold leading-tight text-white">SheryAI</div>
          <div className="text-[10px] leading-none tracking-wider text-muted">Powered by AI</div>
        </div>
      </Link>

      <div className="flex items-center gap-1.5">
        <NavLink to="/dashboard" active={isActive('/dashboard')} icon="book" label="Dashboard" />
        {isInstructor && <NavLink to="/instructor" active={isActive('/instructor')} icon="mic" label="Studio" />}
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
            isInstructor
              ? 'border-accent-border bg-accent-soft text-accent'
              : 'border-blue-400/25 bg-blue-500/10 text-blue-300'
          }`}
        >
          <AppIcon name={isInstructor ? 'mic' : 'graduation'} size={13} />
          {isInstructor ? 'Instructor' : 'Student'}
        </div>
        <button
          type="button"
          onClick={switchRole}
          title="Switch role"
          className="rounded-lg border border-line bg-surface-card px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-white/20 hover:text-white"
        >
          Switch
        </button>
      </div>
    </nav>
  );
}

function NavLink({ to, active, icon, label }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
        active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-hover hover:text-white'
      }`}
    >
      <AppIcon name={icon} size={14} />
      {label}
    </Link>
  );
}
