'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ResultContent } from '@/features/exam-engine/ui';
import { Notice, ScreenLoader } from '@/features/study-plan/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { diagnosticApi } from '../api';

/**
 * Review Solutions of a finished diagnostic (competitive exams; previous app's NEETDiagnosticReview): every question
 * with the right option, the student's pick and the explanation, in the exam engine's competitive review layout.
 */
export function DiagnosticSolutionsScreen() {
  const exam = useExam();
  const assessmentId = useSearchParams().get('assessment_id');
  const review = useQuery({
    queryKey: ['diagnostic', 'review', exam.examId, assessmentId],
    queryFn: () => diagnosticApi.review({ category: exam.category, examId: exam.examId }, assessmentId!),
    enabled: !!assessmentId,
    retry: false,
  });
  const dashboard = routes.dashboard(exam.slug);

  if (!assessmentId)
    return (
      <Notice
        title="No test selected"
        body="Open the solutions from your diagnostic score card."
        action={{ label: 'Back to dashboard', href: dashboard }}
      />
    );
  if (review.isPending) return <ScreenLoader message="Loading Solutions" sub="Fetching your answers and explanations..." />;
  if (review.isError)
    return (
      <Notice
        tone="danger"
        title="Couldn't load the solutions"
        body={userMessage(review.error, 'Something went wrong while loading the solutions.')}
        action={{ label: 'Back to dashboard', href: dashboard }}
      />
    );
  return <ResultContent result={review.data} home={{ label: 'Dashboard', href: dashboard }} category="competitive" />;
}
