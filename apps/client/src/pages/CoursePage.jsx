import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppIcon from '../components/AppIcon';

export default function CoursePage() {
  const { courseId } = useParams();

  return (
    <div className="min-h-screen bg-surface-base font-sans">
      <Navbar />
      <main className="flex h-screenNav flex-col items-center justify-center gap-3.5 text-center">
        <AppIcon name="book" size={48} strokeWidth={1.8} className="text-accent" />
        <h1 className="text-[22px] font-bold text-white">Course Detail</h1>
        <p className="text-[13px] text-muted">Course ID: {courseId}</p>
        <p className="text-sm text-muted">Coming soon in Phase 4</p>
      </main>
    </div>
  );
}
