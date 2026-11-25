import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiagnosticSolutionsScreen } from '@/features/diagnostic/ui';
import { examForCategory } from '@/features/test-library';
import { PageSpinner } from '@/shared/layout/status-screens';

export const metadata: Metadata = { title: 'Diagnostic solutions' };

/** Review Solutions of a diagnostic: competitive exams only (board exams answer 404). */
export default async function DiagnosticSolutionsPage({ params }: { params: Promise<{ exam: string }> }) {
  await examForCategory((await params).exam, 'competitive');
  return (
    <Suspense fallback={<PageSpinner />}>
      <DiagnosticSolutionsScreen />
    </Suspense>
  );
}
