import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveTestType } from '@/features/exam-engine';
import { ExamPlayer } from '@/features/exam-engine/ui';

export const metadata: Metadata = { title: 'Test in progress' };

export default async function TestPlayerPage({
  params,
}: {
  params: Promise<{ exam: string; testType: string; setId: string }>;
}) {
  const { exam, testType, setId } = await params;
  const type = resolveTestType(exam, testType);
  if (!type) notFound();
  return <ExamPlayer testType={type} setId={setId} />;
}
