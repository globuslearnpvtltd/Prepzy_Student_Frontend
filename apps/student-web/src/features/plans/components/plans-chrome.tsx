'use client';

import { useExam } from '@/shared/hooks/use-exam';
import { AppHeader } from '@/shared/layout/app-header';
import { AppChrome } from '@/shared/layout/exam-shell';

/**
 * Frame of /[exam]/plans and /[exam]/plans/billing, as in the previous app: competitive exams keep their
 * navigation rail; board plans pages had the header only, with the full width for the plans table.
 */
export function PlansChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  if (exam.category === 'competitive') return <AppChrome>{children}</AppChrome>;
  return (
    <div className="bg-surface flex min-h-dvh flex-col">
      <AppHeader exam={exam} category={exam.category} />
      <div className="mx-auto w-full max-w-[1440px]">
        <main id="main" className="mb-6 px-5 py-5 md:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
