import type { Metadata } from 'next';
import { examForCategory } from '@/features/test-library';
import { BoardAssessments } from '@/features/test-library/ui';

export const metadata: Metadata = { title: 'Assessments' };

export default async function AssessmentsPage({ params }: { params: Promise<{ exam: string }> }) {
  examForCategory((await params).exam, 'board');
  return <BoardAssessments />;
}
