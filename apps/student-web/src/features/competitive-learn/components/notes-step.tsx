'use client';

import { Check, Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { RichText } from '@/features/exam-engine/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useChapter, useMarkComplete, useStudyNotes } from '../hooks';
import type { ChapterProps } from './chapter-screen';
import { Breadcrumb, ComingSoon, ErrorCard, StepNav } from './kit';

/** Step 2: the chapter's study notes (HTML with maths), PDF download and "Mark As Completed". */
export function NotesStep({ courseId, moduleId, step }: ChapterProps) {
  const exam = useExam();
  const fromNotes = useSearchParams().get('from') === 'notes';
  const chapter = useChapter(moduleId).data;
  const notes = useStudyNotes(moduleId);
  const complete = useMarkComplete('notes', moduleId);
  const data = notes.data;
  const done = !!data?.completed || complete.isSuccess;
  const moduleName = data?.moduleName ?? chapter?.title ?? null;
  const html = data?.html;

  // Search results link to a topic inside the notes (#anchor); scroll there once the notes render.
  useEffect(() => {
    const anchor = typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.slice(1));
    if (!html || !anchor) return;
    const scroll = () => {
      const target = document.getElementById(anchor);
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return !!target;
    };
    if (scroll()) return;
    const timer = setTimeout(scroll, 300);
    return () => clearTimeout(timer);
  }, [html]);

  const download = (
    <a
      href={data?.pdf ? `${data.pdf}?fl_attachment=true` : undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!data?.pdf || undefined}
      className="border-brand-150 bg-brand-50 text-brand flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-[14px] leading-5 font-semibold aria-disabled:pointer-events-none aria-disabled:opacity-60"
    >
      <Download aria-hidden className="size-4" />
      Download
    </a>
  );
  const action = done ? (
    <span className="bg-success-100 text-success-700 flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] leading-5 font-semibold">
      <Check aria-hidden className="size-4" />
      Completed
    </span>
  ) : (
    <button
      type="button"
      disabled={complete.isPending || !data}
      onClick={() => complete.mutate()}
      className="bg-brand text-on-brand flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] leading-5 font-semibold disabled:opacity-60"
    >
      {complete.isPending ? 'Marking...' : 'Mark As Completed'}
    </button>
  );

  const courseHref = routes.learnCourse(exam.slug, courseId);
  if (notes.isError) {
    return (
      <div className="p-[30px]">
        <ErrorCard title="Failed To Fetch Notes" error={notes.error} />
      </div>
    );
  }
  return (
    <div className="p-[30px] max-lg:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          crumbs={[
            { label: data?.courseName ?? chapter?.courseTitle ?? 'Subject', href: courseHref },
            { label: moduleName ?? 'Chapter', href: routes.learnModule(exam.slug, courseId, moduleId, 'video-lectures') },
            { label: 'Study Notes' },
          ]}
          backHref={fromNotes ? routes.notes(exam.slug) : courseHref}
          className="lg:flex-1"
          right={
            <div className="hidden items-center gap-3 lg:flex">
              {action}
              <span className="mx-1 h-8 w-px bg-neutral-200" />
              <StepNav courseId={courseId} moduleId={moduleId} step={step} />
            </div>
          }
        />
        <div className="flex items-center gap-3 lg:hidden">
          {download}
          {action}
        </div>
      </div>

      <div className="mt-[18px] flex w-full flex-col gap-[22px]">
        <div className="bg-surface flex flex-col gap-4 rounded-xl border border-neutral-200 p-5 lg:p-[30px]">
          {notes.isPending ? (
            <p className="text-neutral-800">Loading...</p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-4">
                <p className="text-[12px] leading-3 text-neutral-800 lg:text-[16px] lg:leading-4">Chapter {data?.order ?? ''}</p>
                <h1 className="text-brand text-[24px] leading-[26px] font-bold lg:text-[40px] lg:leading-10">{moduleName}</h1>
              </div>
              <div className="hidden lg:block">{download}</div>
            </div>
          )}
        </div>
        <div className="bg-surface rounded-xl border border-neutral-200 p-[30px]">
          {notes.isPending ? (
            <p className="text-neutral-800">Loading...</p>
          ) : html ? (
            <RichText html={html} className="study-notes" />
          ) : (
            <ComingSoon
              title="Notes Coming Soon!"
              icon={
                <svg aria-hidden width="44" height="44" viewBox="0 0 48 48" fill="none" className="stroke-brand" strokeWidth="2" strokeLinejoin="round">
                  <path d="M10 14C10 11.7909 11.7909 10 14 10H30L38 18V34C38 36.2091 36.2091 38 34 38H14C11.7909 38 10 36.2091 10 34V14Z" />
                  <path d="M30 10V18H38" />
                  <path d="M17 25H31" strokeLinecap="round" />
                  <path d="M17 30H26" strokeLinecap="round" />
                </svg>
              }
            >
              Our academic team is putting together detailed notes for{' '}
              <span className="font-semibold text-neutral-700">{moduleName || 'this chapter'}</span>. Check back shortly — great notes
              take a little time!
            </ComingSoon>
          )}
        </div>
      </div>
    </div>
  );
}
