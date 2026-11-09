'use client';

import { useExam } from '@/shared/hooks/use-exam';
import { AppHeader } from './app-header';
import { CompetitiveSidebar } from './competitive-navigation';

/**
 * Chrome around the test player and its result, as in the previous app: the header stays (so the student
 * can see where they are), but the board sidebar and mobile bottom bar don't, so nothing pulls focus.
 * Competitive exams keep their icon rail.
 */
export function FocusChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  return (
    <div className="bg-canvas min-h-dvh">
      <AppHeader exam={exam} category={exam.category} />
      <div className="flex">
        {exam.category === 'competitive' && <CompetitiveSidebar exam={exam} />}
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
