import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LectureScreen } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';

export const metadata: Metadata = { title: 'Lecture' };

type Params = Promise<{ exam: string; courseId: string; moduleId: string; lectureId: string }>;

/** /[exam]/learn/[courseId]/[moduleId]/lecture/[lectureId] — a board lecture. */
export default async function LecturePage({ params }: { params: Params }) {
  const { exam: slug, courseId, moduleId, lectureId } = await params;
  if (getExam(slug)?.category !== 'board') notFound();
  return <LectureScreen courseId={courseId} moduleId={moduleId} lectureId={lectureId} />;
}
