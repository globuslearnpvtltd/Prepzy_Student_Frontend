import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CourseDetailScreen } from '@/features/learn/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'Course details' };

/** /[exam]/courses/[courseId] — one course's overview. */
export default async function CourseDetailPage({ params }: { params: Promise<{ exam: string; courseId: string }> }) {
  const { exam: slug, courseId } = await params;
  if ((await resolveExam(slug))?.category !== 'board') notFound();
  return <CourseDetailScreen courseId={courseId} />;
}
