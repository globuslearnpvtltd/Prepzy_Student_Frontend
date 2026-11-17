import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SyllabusScreen } from '@/features/syllabus/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'PYQ Trends' };

type Props = { params: Promise<{ exam: string }>; searchParams: Promise<{ subject_id?: string | string[] }> };

/** /[exam]/pyq-trends?subject_id= — board exams (previous app's /trend-analysis). */
export default async function PyqTrendsPage({ params, searchParams }: Props) {
  // Syllabus and PYQ trend PDFs are a board-category feature.
  if ((await resolveExam((await params).exam))?.category !== 'board') notFound();
  const subject = (await searchParams).subject_id;
  return <SyllabusScreen kind="trend" subjectId={(Array.isArray(subject) ? subject[0] : subject) || null} />;
}
