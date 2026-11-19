import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { NotesViewScreen } from '@/features/notes/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'Notes' };

/** /[exam]/notes/[courseId] — a book's chapter notes (board exams). */
export default async function NotesViewPage({ params }: { params: Promise<{ exam: string; courseId: string }> }) {
  const { exam: slug, courseId } = await params;
  if ((await resolveExam(slug))?.category !== 'board') notFound();
  return (
    <Suspense>
      <NotesViewScreen courseId={courseId} />
    </Suspense>
  );
}
