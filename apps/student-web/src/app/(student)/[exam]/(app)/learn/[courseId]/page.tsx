import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompetitiveCourse } from '@/features/competitive-learn/ui';
import { CourseEntry } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';
import { SectionPlaceholder } from '@/shared/layout/section-placeholder';

export const metadata: Metadata = { title: 'Learn' };

/** /[exam]/learn/[courseId] — a course's chapters; the screen depends on the exam's category. */
export default async function CoursePage({ params }: { params: Promise<{ exam: string; courseId: string }> }) {
  const { exam: slug, courseId } = await params;
  const exam = getExam(slug);
  if (!exam) notFound();
  if (exam.category === 'competitive') return <CompetitiveCourse courseId={courseId} />;
  if (exam.category === 'board') return <CourseEntry courseId={courseId} />;
  return <SectionPlaceholder title="Learn" />;
}
