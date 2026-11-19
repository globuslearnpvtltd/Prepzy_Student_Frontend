import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SummaryVideoScreen } from '@/features/notes/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'Summary video' };

/** /[exam]/notes/video/[noteId] — a chapter's summary video. */
export default async function SummaryVideoPage({ params }: { params: Promise<{ exam: string; noteId: string }> }) {
  const { exam: slug, noteId } = await params;
  if ((await resolveExam(slug))?.category !== 'board') notFound();
  return <SummaryVideoScreen noteId={noteId} />;
}
