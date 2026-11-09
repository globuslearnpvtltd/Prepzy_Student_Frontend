import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CHAPTER_STEPS, isChapterStep } from '@/features/competitive-learn';
import { CompetitiveChapter } from '@/features/competitive-learn/ui';
import { getExam } from '@/shared/config/exams';

type Params = Promise<{ exam: string; courseId: string; moduleId: string; step: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { step } = await params;
  return { title: CHAPTER_STEPS.find((s) => s.key === step)?.title ?? 'Learn' };
}

/** /[exam]/learn/[courseId]/[moduleId]/[step] — one step of a competitive chapter. */
export default async function ChapterStepPage({ params }: { params: Params }) {
  const { exam: slug, courseId, moduleId, step } = await params;
  const exam = getExam(slug);
  if (!exam || exam.category !== 'competitive' || !isChapterStep(step)) notFound();
  return <CompetitiveChapter courseId={courseId} moduleId={moduleId} step={step} />;
}
