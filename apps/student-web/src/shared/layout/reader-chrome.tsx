'use client';

import { useExam } from '@/shared/hooks/use-exam';
import { AppHeader } from './app-header';
import { CompetitiveSidebar } from './competitive-navigation';

/**
 * Chrome around reading pages (chapter notes, summary videos, the course catalogue and a course's details), as in the
 * previous app's non-dashboard pages: the header only, full width, no board sidebar or mobile bottom bar, so the page
 * can lay out its own reader. Competitive exams keep their navigation drawer behind the header's menu button (no rail).
 */
export function ReaderChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  return (
    <div className="bg-canvas min-h-dvh">
      <AppHeader exam={exam} category={exam.category} />
      {exam.category === 'competitive' && <CompetitiveSidebar exam={exam} rail={false} />}
      <main id="main" className="w-full min-w-0">
        {children}
      </main>
    </div>
  );
}
