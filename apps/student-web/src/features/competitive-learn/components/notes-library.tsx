'use client';

import { cx } from '@prepzy/design-system';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { useTestContext } from '@/features/exam-engine';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useNotesChapters, useNotesSubjects } from '../hooks';
import { Breadcrumb, ChapterRow, ErrorCard, ListSkeleton } from './kit';

/** Competitive "Notes Library": subject tabs, chapter counts and every chapter's notes. */
export function NotesLibrary() {
  const exam = useExam();
  const { context, isPending: planPending } = useTestContext();
  const classId = context?.classId ?? null;
  const subjects = useNotesSubjects(classId);
  const [picked, setPicked] = useState<string | null>(null);
  const subjectId = picked ?? subjects.data?.[0]?.id ?? null;
  const chapters = useNotesChapters(classId, subjectId);

  const stats = [
    { label: 'Total Chapters', value: chapters.data?.total ?? 0, tint: 'bg-brand' },
    { label: 'Chapters completed', value: chapters.data?.completed ?? 0, tint: 'bg-accent-700' },
  ];
  const loadingSubjects = planPending || subjects.isPending;

  return (
    <div className="flex w-full flex-col items-start space-y-4 p-3 sm:space-y-6 lg:p-0">
      <Breadcrumb crumbs={[{ label: 'Dashboard', href: routes.dashboard(exam.slug) }, { label: 'Notes' }]} backHref={routes.dashboard(exam.slug)} />
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-950 sm:text-[28px] sm:leading-9 lg:mt-2">{exam.label} Notes Library</h1>
          <p className="text-[10px] text-neutral-550 sm:text-[14px] lg:mt-1">
            Master high-yield concepts mapped strictly to the latest NCERT pattern
          </p>
        </div>
        <div role="tablist" aria-label="Subjects" className="bg-surface flex w-full flex-wrap gap-1 rounded-lg p-1 shadow-sm lg:w-auto lg:py-2.5">
          {subjects.data?.map((subject) => {
            const active = subject.id === subjectId;
            return (
              <button
                key={subject.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPicked(subject.id)}
                className={cx(
                  'flex-1 rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors lg:flex-initial lg:px-4 lg:py-2 lg:text-[13px]',
                  active ? 'bg-brand text-on-brand' : 'hover:bg-neutral-50 text-neutral-550',
                )}
              >
                {subject.name}
              </button>
            );
          })}
          {!loadingSubjects && !subjects.isError && subjects.data?.length === 0 && (
            <span className="px-4 py-2 text-[13px] text-neutral-350">No subjects found</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface flex items-start gap-3 rounded-lg border border-neutral-100 p-2 shadow-sm sm:rounded-xl lg:p-4">
            <span className={cx('my-auto flex size-10 shrink-0 items-center justify-center rounded-md sm:size-11', stat.tint)}>
              <BookOpen aria-hidden className="text-on-brand size-[18px] sm:size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-lg leading-tight font-bold text-neutral-950 sm:text-[20px]">{stat.value}</span>
              <span className="text-[12px] font-medium text-neutral-550">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex w-full flex-col gap-3 lg:gap-4">
        {subjects.isError ? (
          <ErrorCard title="Failed to load subjects" error={subjects.error} />
        ) : chapters.isError ? (
          <ErrorCard title="Failed to load chapters" error={chapters.error} />
        ) : loadingSubjects || (subjectId && chapters.isPending) ? (
          <ListSkeleton />
        ) : !chapters.data || chapters.data.chapters.length === 0 ? (
          <p className="text-[13px] text-neutral-550">No chapters found for this subject.</p>
        ) : (
          chapters.data.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.moduleId}
              number={chapter.order}
              title={chapter.title}
              status={chapter.status}
              percent={chapter.status === 'completed' ? 100 : chapter.status === 'in_progress' ? 50 : 0}
              locked={chapter.locked}
              href={`${routes.learnModule(exam.slug, chapter.courseId, chapter.moduleId, 'study-notes')}?from=notes`}
            />
          ))
        )}
      </div>
    </div>
  );
}
