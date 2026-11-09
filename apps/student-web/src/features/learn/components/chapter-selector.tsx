'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { ChevronDown, ChevronLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useExam } from '@/shared/hooks/use-exam';
import { routes } from '@/shared/config/routes';
import { activityHref, formatTitle, titleCase } from '../api';
import { useCourseOutline } from '../hooks';

/** Chapter bar (course · chapter n of m, chapter title) with a drawer to switch chapter or open an exam. */
export function ChapterSelector({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const exam = useExam();
  const outline = useCourseOutline(courseId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (outline.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading chapter" className="w-full pt-3 pb-3 md:pt-4">
        <Skeleton className="mb-3 ml-2 hidden h-3 w-[90px] md:block" />
        <Skeleton className="h-[64px] w-full rounded-lg" />
      </div>
    );
  }
  if (!outline.data?.course) return null;
  const { course, chapters, exams } = outline.data;
  const activeIndex = chapters.findIndex((chapter) => chapter.id === moduleId);
  const active = chapters[activeIndex];

  return (
    <>
      <div className="w-full pt-3 pb-3 md:pt-4">
        <p className="text-neutral-550 mb-3 ml-2 hidden text-[12px] leading-5 font-medium md:block">{titleCase(course.subjectName)}</p>
        <div className="border-learn-line bg-surface flex items-center justify-between gap-2 rounded-lg border-2 px-2.5 py-2.5 md:gap-3 md:px-3 md:py-3.5">
          <div className="flex min-w-0 items-center gap-2 md:gap-3.5">
            <Link href={routes.learn(exam.slug)} aria-label="Go back" className="text-brand shrink-0 p-1">
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-learn-muted truncate text-[9px] leading-[14px] font-semibold tracking-[0.6px] uppercase md:text-[11px] md:leading-4">
                {course.name}
                {active && ` · Chapter ${activeIndex + 1} of ${chapters.length}`}
              </p>
              <p className="text-learn-ink truncate text-[14px] leading-5 font-semibold md:text-[18px] md:leading-6">
                {formatTitle(active?.title)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Change chapter"
            className="text-brand md:bg-brand-50 flex shrink-0 items-center gap-2 rounded-[14px] p-1.5 text-[13px] leading-5 font-semibold md:px-4 md:py-2.5"
          >
            <span className="hidden md:inline">Change chapter</span>
            <ChevronDown aria-hidden className="size-[18px]" />
          </button>
        </div>
      </div>

      <div
        aria-hidden={!open}
        className={cx(
          'fixed inset-0 z-50 flex items-end justify-end transition-[visibility] duration-300 md:items-stretch',
          open ? 'pointer-events-auto visible' : 'pointer-events-none invisible',
        )}
      >
        <div
          className={cx('bg-learn-ink/40 absolute inset-0 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Change chapter"
          className={cx(
            'bg-surface relative flex max-h-[80vh] w-full flex-col rounded-t-xl shadow-lg transition-transform duration-300 md:h-full md:max-h-none md:max-w-[420px] md:rounded-t-none md:rounded-l-xl',
            open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0',
          )}
        >
          <div className="bg-learn-handle mx-auto mt-2.5 h-1 w-10 rounded-full md:hidden" />
          <div className="flex items-start justify-between px-6 pt-4 pb-4 md:pt-6">
            <div className="flex flex-col">
              <span className="text-learn-ink text-[18px] leading-[26px] font-semibold">Change chapter</span>
              <span className="text-learn-muted text-[12px] leading-[18px]">{chapters.length} chapters</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-learn-muted p-1">
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-6">
            {chapters.map((chapter, index) => {
              const isActive = index === activeIndex;
              return (
                <Link
                  key={chapter.id}
                  href={routes.boardModule(exam.slug, courseId, chapter.id)}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  tabIndex={open ? 0 : -1}
                  className={cx(
                    'flex items-center gap-3.5 rounded-md px-3 py-3.5',
                    isActive ? 'bg-brand-75' : 'hover:bg-learn-hover',
                  )}
                >
                  <span
                    className={cx(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                      isActive ? 'bg-brand text-on-brand' : 'bg-learn-soft text-learn-muted',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cx('flex-1 text-[14px] leading-5', isActive ? 'text-brand font-semibold' : 'text-learn-ink font-medium')}>
                    {formatTitle(chapter.title)}
                  </span>
                </Link>
              );
            })}
            {exams.length > 0 && (
              <span className="text-learn-muted mt-4 mb-1 px-3 text-[11px] font-semibold tracking-[0.6px] uppercase">Exams</span>
            )}
            {exams.map((item) => (
              <Link
                key={`exam-${item.id}`}
                href={activityHref(exam.slug, courseId, { category: 'assessment', id: item.id, moduleId: null, type: item.type })}
                tabIndex={open ? 0 : -1}
                className="hover:bg-learn-hover text-learn-ink rounded-md px-3 py-3.5 text-[14px] leading-5 font-medium"
              >
                {item.type === 'mid_term_exam' ? 'Mid Term' : 'Final Exam'}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
