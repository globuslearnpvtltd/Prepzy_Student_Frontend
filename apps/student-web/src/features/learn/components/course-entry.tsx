'use client';

import { Skeleton } from '@prepzy/design-system';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useCourseOutline } from '../hooks';
import { SectionError } from './kit';

/** /[exam]/learn/[courseId] on board exams: opens the course at its first chapter. */
export function CourseEntry({ courseId }: { courseId: string }) {
  const exam = useExam();
  const router = useRouter();
  const outline = useCourseOutline(courseId);
  const first = outline.data?.chapters[0];

  useEffect(() => {
    if (first) router.replace(routes.boardModule(exam.slug, courseId, first.id));
  }, [first, router, exam.slug, courseId]);

  if (outline.isError || (outline.data && !first)) {
    return <SectionError title="Failed to fetch module outline" error={outline.error ?? undefined} />;
  }
  return (
    <div aria-busy="true" aria-label="Opening course" className="flex w-full flex-col gap-4 px-1 md:px-[22px]">
      <Skeleton className="h-[64px] w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-full md:w-[335px]" />
      <Skeleton className="h-[92px] w-full rounded-xl" />
    </div>
  );
}
