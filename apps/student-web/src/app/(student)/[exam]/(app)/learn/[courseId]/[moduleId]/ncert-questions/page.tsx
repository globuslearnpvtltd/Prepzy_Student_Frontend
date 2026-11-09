import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NcertQuestionsScreen } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';

export const metadata: Metadata = { title: 'NCERT Chapter Questions' };

/** /[exam]/learn/[courseId]/[moduleId]/ncert-questions — NCERT end-of-chapter questions. */
export default async function NcertQuestionsPage({ params }: { params: Promise<{ exam: string; courseId: string; moduleId: string }> }) {
  const { exam: slug, courseId, moduleId } = await params;
  if (getExam(slug)?.category !== 'board') notFound();
  return <NcertQuestionsScreen courseId={courseId} moduleId={moduleId} />;
}
