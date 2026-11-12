'use client';

import { useExam } from '@/shared/hooks/use-exam';
import { AppHeader } from '@/shared/layout/app-header';

/**
 * Frame of /[exam]/plans/purchase: the app header (fixed, 76px desktop / 70px mobile) and no sidebar, for every
 * exam. The checkout fills the rest; its sticky panels sit below the header (lg:top-[100px]).
 */
export function CheckoutChrome({ children }: { children: React.ReactNode }) {
  const exam = useExam();
  return (
    <div className="bg-surface flex min-h-dvh flex-col">
      <AppHeader exam={exam} category={exam.category} />
      <main id="main" className="bg-surface flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
