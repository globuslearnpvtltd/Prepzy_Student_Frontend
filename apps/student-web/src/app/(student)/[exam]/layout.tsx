import { notFound } from 'next/navigation';
import { examList, getExam } from '@/shared/config/exams';
import { ExamFrame } from '@/shared/layout/exam-shell';

/** Only exams in the registry exist; anything else is a 404. */
export function generateStaticParams() {
  return examList.map((exam) => ({ exam: exam.slug }));
}

export const dynamicParams = false;

export default async function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ exam: string }>;
}) {
  const { exam } = await params;
  const config = getExam(exam);
  if (!config) notFound();
  return <ExamFrame examSlug={config.slug}>{children}</ExamFrame>;
}
