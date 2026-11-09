import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChapterPyqsScreen } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';

export const metadata: Metadata = { title: 'Chapter PYQs' };

/** /[exam]/learn/[courseId]/[moduleId]/pyqs — a board chapter's previous-year questions. */
export default async function ChapterPyqsPage({ params }: { params: Promise<{ exam: string; courseId: string; moduleId: string }> }) {
  const { exam: slug, courseId, moduleId } = await params;
  if (getExam(slug)?.category !== 'board') notFound();
  return <ChapterPyqsScreen courseId={courseId} moduleId={moduleId} />;
}
