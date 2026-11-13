'use client';

import { useExam } from '@/shared/hooks/use-exam';
import { AppHeader } from '@/shared/layout/app-header';
import { CompetitiveSidebar } from '@/shared/layout/competitive-navigation';

/**
 * Frame of the account pages, as in the previous app: the header only, full width on white, no sidebar or
 * bottom bar. Competitive exams keep the header's mobile menu drawer (no desktop rail).
 */
export function ProfileChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  return (
    <div className="bg-surface min-h-dvh">
      <AppHeader exam={exam} category={exam.category} />
      {exam.category === 'competitive' && <CompetitiveSidebar exam={exam} rail={false} />}
      <main id="main" className="bg-surface w-full min-w-0">
        {children}
      </main>
    </div>
  );
}
