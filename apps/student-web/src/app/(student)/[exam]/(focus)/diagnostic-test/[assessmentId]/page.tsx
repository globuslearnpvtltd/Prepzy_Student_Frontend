import type { Metadata } from 'next';
import { DiagnosticTestScreen } from '@/features/diagnostic/ui';

export const metadata: Metadata = { title: 'Diagnostic test in progress' };

export default async function DiagnosticTestPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  return <DiagnosticTestScreen assessmentId={assessmentId} />;
}
