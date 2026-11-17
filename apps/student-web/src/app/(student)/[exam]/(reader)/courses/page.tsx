import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { CoursesScreen } from '@/features/learn/ui';
import { resolveExam } from '@/shared/config/exam-resolver';

export const metadata: Metadata = { title: 'Courses' };

/** /[exam]/courses — the course catalogue (board exams). */
export default async function CoursesPage({ params }: { params: Promise<{ exam: string }> }) {
  if ((await resolveExam((await params).exam))?.category !== 'board') notFound();
  return (
    <div className="pt-5 pb-10 md:pt-8">
      <Suspense>
        <CoursesScreen />
      </Suspense>
    </div>
  );
}
