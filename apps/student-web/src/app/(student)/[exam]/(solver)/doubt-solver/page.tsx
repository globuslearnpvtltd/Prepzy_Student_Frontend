import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DoubtSolverScreen } from '@/features/doubt-solver/ui';

export const metadata: Metadata = { title: 'Ask Socrates' };

export default function DoubtSolverPage() {
  return (
    <Suspense fallback={null}>
      <DoubtSolverScreen />
    </Suspense>
  );
}
