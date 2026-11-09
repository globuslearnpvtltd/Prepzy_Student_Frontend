import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { FIRST_STEP } from '@/features/competitive-learn';
import { ModuleScreen } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { SectionPlaceholder } from '@/shared/layout/section-placeholder';

export const metadata: Metadata = { title: 'Learn' };

/** /[exam]/learn/[courseId]/[moduleId] — competitive chapters open on their first step. */
export default async function ChapterPage({ params }: { params: Promise<{ exam: string; courseId: string; moduleId: string }> }) {
  const { exam: slug, courseId, moduleId } = await params;
  const exam = getExam(slug);
  if (!exam) notFound();
  if (exam.category === 'competitive') redirect(routes.learnModule(exam.slug, courseId, moduleId, FIRST_STEP));
  if (exam.category === 'board') {
    return (
      <Suspense>
        <ModuleScreen courseId={courseId} moduleId={moduleId} />
      </Suspense>
    );
  }
  return <SectionPlaceholder title="Learn" />;
}
