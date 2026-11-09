import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SolverDiscovery, SyllabusCards } from '@/features/dashboard';
import { LearnScreen } from '@/features/learn/ui';
import { getExam } from '@/shared/config/exams';
import { SectionPlaceholder } from '@/shared/layout/section-placeholder';

export const metadata: Metadata = { title: 'Learn' };

/** /[exam]/learn — the screen depends on the exam's category. */
export default async function LearnPage({ params }: { params: Promise<{ exam: string }> }) {
  const exam = getExam((await params).exam);
  if (!exam) notFound();
  if (exam.category !== 'board') return <SectionPlaceholder title="Learn" />;
  return (
    <LearnScreen
      aside={
        <>
          <SolverDiscovery />
          <SyllabusCards />
        </>
      }
    />
  );
}
