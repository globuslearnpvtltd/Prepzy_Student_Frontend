'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { PageSpinner } from '@/shared/layout/status-screens';
import { BillingHistory } from './billing-history';
import { BoardManagePlans } from './manage-board';
import { CompetitiveManagePlans } from './manage-competitive';

/** /[exam]/plans — the board and competitive designs of the previous app's plan pages. */
export function ManagePlans() {
  const exam = useExam();
  return exam.category === 'competitive' ? <CompetitiveManagePlans exam={exam} /> : <BoardManagePlans exam={exam} />;
}

/**
 * /[exam]/plans/billing — competitive exams have an account-wide invoice list; board plans show their
 * billing history per plan on the plans page, so that's where this goes for them.
 */
export function BillingPage() {
  const exam = useExam();
  const router = useRouter();
  const competitive = exam.category === 'competitive';
  useEffect(() => {
    if (!competitive) router.replace(routes.plans(exam.slug));
  }, [competitive, exam.slug, router]);
  return competitive ? <BillingHistory exam={exam} /> : <PageSpinner />;
}
