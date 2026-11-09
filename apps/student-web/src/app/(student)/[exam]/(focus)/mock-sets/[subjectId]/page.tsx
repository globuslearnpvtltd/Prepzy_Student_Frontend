import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { BoardPaperSets } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'Mock Exams' };

export default async function MockSetsPage({ params }: { params: Promise<{ exam: string; subjectId: string }> }) {
  const { exam, subjectId } = await params;
  examForCategory(exam, 'board');
  return <BoardPaperSets kind="mock" subjectId={subjectId} />;
}
