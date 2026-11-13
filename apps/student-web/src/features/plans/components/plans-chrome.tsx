'use client';

import { findExam, REFERENCE, type ExamConfig } from '@/shared/config/exams';
import { ExamProvider } from '@/shared/hooks/use-exam';
import { AppHeader } from '@/shared/layout/app-header';
import { PageSpinner } from '@/shared/layout/status-screens';
import { useAccountExam } from '@/shared/layout/use-account-exam';
import { useCheckoutExam } from '../hooks';

/**
 * Frame of /purchase: the app header (fixed, 76px desktop / 70px mobile) and no sidebar, for every exam. The header
 * and theme are the selected exam's (?exam=, see useCheckoutExam); an exam the app has no pages for yet shows the
 * student's current exam (as /manage-plans does), else the plain header. The checkout fills the rest; its sticky
 * panels sit below the header (lg:top-[100px]).
 */
export function CheckoutChrome({ children }: { children: React.ReactNode }) {
  const selection = useCheckoutExam();
  const account = useAccountExam();
  const design = selection.exam ? findExam(selection.exam.examSlice) : null;
  const selected: ExamConfig | null =
    selection.exam && design && design.category === selection.exam.category ? { ...design, examId: selection.exam.examId } : null;
  const exam = selected ?? account.exam;

  // The checkout shows its own error screen when the exam list fails.
  if (selection.isPending || (!selected && !selection.isError && account.isPending)) return <PageSpinner />;

  const frame = (
    <div data-theme={exam?.theme ?? REFERENCE.theme} className="bg-surface flex min-h-dvh flex-col">
      <AppHeader exam={exam} category={exam?.category ?? REFERENCE.category} />
      <main id="main" className="bg-surface flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
  return exam ? <ExamProvider value={exam}>{frame}</ExamProvider> : frame;
}
