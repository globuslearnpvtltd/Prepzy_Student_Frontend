import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveTestType } from '@/features/exam-engine';
import { ResultView } from '@/features/exam-engine/ui';

export const metadata: Metadata = { title: 'Result' };

export default async function TestResultPage({
  params,
}: {
  params: Promise<{ exam: string; testType: string; attemptId: string }>;
}) {
  const { exam, testType, attemptId } = await params;
  const type = resolveTestType(exam, testType);
  if (!type) notFound();
  return <ResultView testType={type} attemptId={attemptId} />;
}
