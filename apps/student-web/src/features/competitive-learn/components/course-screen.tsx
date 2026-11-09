'use client';

import { cx } from '@prepzy/design-system';
import { BookOpen, ClipboardPen, Files, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useChapter, useCourse } from '../hooks';
import { FIRST_STEP } from '../steps';
import { Breadcrumb, ChapterRow, ErrorCard, ListSkeleton } from './kit';

function StatCard({ label, done, total, icon, tone }: { label: string; done: number; total: number; icon: ReactNode; tone: 'accent' | 'brand' }) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-2 rounded-xl border-2 p-2.5 sm:p-3',
        tone === 'accent' ? 'bg-accent-50 border-accent-400/20' : 'bg-brand-50 border-brand-150',
      )}
    >
      <div className="min-w-0">
        <p className="mb-1 truncate text-[11px] leading-4 font-medium text-neutral-550 sm:mb-2 sm:text-[12px]">{label}</p>
        <p className="text-[20px] leading-6 font-bold whitespace-nowrap text-neutral-800 sm:text-[28px] sm:leading-8 md:text-[36px] md:leading-9">
          {done} / {total}
        </p>
      </div>
      <span
        className={cx(
          'text-on-brand flex size-8 shrink-0 items-center justify-center rounded-full sm:size-11',
          tone === 'accent' ? 'bg-accent-400' : 'bg-brand',
        )}
      >
        {icon}
      </span>
    </div>
  );
}

/** A competitive course: video / notes / test / PYQ totals and its chapters. */
export function CourseScreen({ courseId }: { courseId: string }) {
  const exam = useExam();
  const course = useCourse(courseId);
  const firstModule = course.data?.chapters[0]?.moduleId;
  const subject = useChapter(firstModule).data?.subject;
  const chapters = course.data?.chapters ?? [];
  const total = chapters.length;
  const completed = chapters.filter((c) => c.status === 'completed').length;
  const done = course.data?.done;
  const icon = 'size-5 sm:size-6';

  return (
    <div className="relative min-h-dvh p-6">
      <Breadcrumb
        crumbs={[{ label: 'Dashboard', href: routes.dashboard(exam.slug) }, { label: subject ?? 'Subject' }]}
        backHref={routes.dashboard(exam.slug)}
      />
      {course.isError ? (
        <ErrorCard title="Failed to fetch course modules. Please try again." error={course.error} />
      ) : (
        <>
          <div className="border-brand-75 bg-surface mt-4 mb-8 grid grid-cols-2 gap-4 rounded-xl border p-4 md:grid-cols-4 lg:p-6">
            <StatCard label="Videos" done={done?.videos ?? 0} total={total} tone="accent" icon={<Video aria-hidden className={icon} />} />
            <StatCard label="Notes" done={done?.notes ?? 0} total={total} tone="brand" icon={<BookOpen aria-hidden className={icon} />} />
            <StatCard label="Tests" done={done?.tests ?? 0} total={total} tone="accent" icon={<ClipboardPen aria-hidden className={icon} />} />
            <StatCard label="PYQs" done={done?.pyqs ?? 0} total={total} tone="brand" icon={<Files aria-hidden className={icon} />} />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-[15px] leading-5 font-medium text-neutral-900">Chapters</h1>
            <span className="text-xs text-neutral-350">
              {completed}/{total} completed
            </span>
          </div>
          {course.isPending ? (
            <ListSkeleton />
          ) : total === 0 ? (
            <div className="bg-surface flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
              <p className="text-sm font-medium text-neutral-600">No chapters yet</p>
              <p className="mt-1 text-xs text-neutral-350">Chapters will show up here once they&apos;re added to this course.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {chapters.map((chapter, index) => (
                <ChapterRow
                  key={chapter.moduleId}
                  number={index + 1}
                  title={chapter.title}
                  tag={chapter.tag}
                  status={chapter.status}
                  percent={chapter.percent}
                  href={routes.learnModule(exam.slug, courseId, chapter.moduleId, FIRST_STEP)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
