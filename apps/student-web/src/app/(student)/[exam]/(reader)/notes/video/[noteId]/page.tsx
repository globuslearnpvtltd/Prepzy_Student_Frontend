import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SummaryVideoScreen } from '@/features/notes/ui';
import { getExam } from '@/shared/config/exams';

export const metadata: Metadata = { title: 'Summary video' };

/** /[exam]/notes/video/[noteId] — a chapter's summary video. */
export default async function SummaryVideoPage({ params }: { params: Promise<{ exam: string; noteId: string }> }) {
  const { exam: slug, noteId } = await params;
  if (getExam(slug)?.category !== 'board') notFound();
  return <SummaryVideoScreen noteId={noteId} />;
}
