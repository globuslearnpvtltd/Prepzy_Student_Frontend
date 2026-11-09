import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiagnosticResultScreen } from '@/features/diagnostic/ui';
import { PageSpinner } from '@/shared/layout/status-screens';

export const metadata: Metadata = { title: 'Your diagnostic report' };

export default function DiagnosticResultPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DiagnosticResultScreen />
    </Suspense>
  );
}
