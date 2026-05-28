import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppIcon from '../components/AppIcon';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-base font-sans">
      <Navbar />
      <main className="flex h-screenNav flex-col items-center justify-center gap-5 px-6 text-center">
        <AppIcon name="flame" size={56} strokeWidth={1.8} className="mb-1 text-accent" />
        <h1 className="mb-2 text-4xl font-black text-white">SheryAI</h1>
        <p className="mb-7 max-w-[420px] text-base text-muted">
          AI-powered learning - ask your lecture anything, get instant answers with timestamps.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/login" className="rounded-[10px] bg-accent px-7 py-3 text-[15px] font-bold text-white">
            Get Started
          </Link>
          <Link
            to="/dashboard"
            className="rounded-[10px] border border-line bg-surface-card px-7 py-3 text-[15px] font-semibold text-muted-text"
          >
            My Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
