import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-base px-6 text-center font-sans">
      <div className="text-8xl font-black leading-none text-white/5">404</div>
      <section className="-mt-8">
        <h1 className="mb-2 text-2xl font-bold text-white">Page not found</h1>
        <p className="text-sm text-muted">The page you're looking for doesn't exist.</p>
      </section>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-[10px] bg-accent px-[22px] py-2.5 text-sm font-semibold text-white">
          Go Home
        </Link>
        <Link
          to="/dashboard"
          className="rounded-[10px] border border-line bg-surface-card px-[22px] py-2.5 text-sm font-semibold text-muted-text"
        >
          My Courses
        </Link>
      </div>
    </main>
  );
}
