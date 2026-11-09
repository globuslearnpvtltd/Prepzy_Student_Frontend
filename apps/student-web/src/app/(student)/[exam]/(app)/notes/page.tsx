import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CompetitiveNotes } from '@/features/competitive-learn/ui';
import { SolverDiscovery, SyllabusCards } from '@/features/dashboard';
import { NotesScreen } from '@/features/notes/ui';
import { getExam } from '@/shared/config/exams';
import { SectionPlaceholder } from '@/shared/layout/section-placeholder';

export const metadata: Metadata = { title: 'Notes' };

/** /[exam]/notes — the screen depends on the exam's category. */
export default async function NotesPage({ params }: { params: Promise<{ exam: string }> }) {
  const exam = getExam((await params).exam);
  if (!exam) notFound();
  if (exam.category === 'competitive') return <CompetitiveNotes />;
  if (exam.category === 'board') {
    return (
      <NotesScreen
        aside={
          <>
            <SolverDiscovery />
            <SyllabusCards />
          </>
        }
      />
    );
  }
  return <SectionPlaceholder title="Notes" />;
}
