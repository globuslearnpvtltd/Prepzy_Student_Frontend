import { notFound } from 'next/navigation';
import { examList } from '@/shared/config/exams';
import { resolveExam } from '@/shared/config/exam-resolver';
import { ExamFrame } from '@/shared/layout/exam-shell';

/**
 * Registry exams are prerendered; any other active exam of the backend (its exam_slice as the URL) renders on its
 * first visit. A slug that names no active exam is a 404.
 */
export function generateStaticParams() {
  return examList.map((exam) => ({ exam: exam.slug }));
}

export const dynamicParams = true;

export default async function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ exam: string }>;
}) {
  const { exam } = await params;
  const config = await resolveExam(exam);
  if (!config) notFound();
  return <ExamFrame design={config}>{children}</ExamFrame>;
}
