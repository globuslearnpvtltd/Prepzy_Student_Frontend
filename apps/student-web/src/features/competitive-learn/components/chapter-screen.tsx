'use client';

import { cx } from '@prepzy/design-system';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useChapter } from '../hooks';
import { CHAPTER_STEPS, type ChapterStep } from '../steps';
import { StepNav } from './kit';
import { NotesStep } from './notes-step';
import { ChapterPyqStep, PracticeStep } from './test-step';
import { VideoStep } from './video-step';

export interface ChapterProps {
  courseId: string;
  moduleId: string;
  step: ChapterStep;
}

/** Subject, chapter title, overall progress and the four steps. */
function ChapterSidebar({ courseId, moduleId, step }: ChapterProps) {
  const exam = useExam();
  const chapter = useChapter(moduleId);
  if (chapter.isPending) {
    return <aside className="bg-surface w-80 max-w-full p-5 text-sm">Loading...</aside>;
  }
  const info = chapter.data;
  const percent = info?.percent ?? 0;
  return (
    <aside aria-label="Chapter" className="bg-surface relative flex h-full w-80 max-w-full shrink-0 flex-col border-r border-neutral-100 px-5 pt-6">
      {info?.subject && <span className="bg-brand-100 text-brand w-fit rounded-full px-3 py-1 text-xs font-semibold">{info.subject}</span>}
      <h2 className="mt-3 text-2xl leading-snug font-extrabold text-neutral-950">{info?.title ?? 'Chapter'}</h2>
      <div className="mt-5 flex justify-between text-sm">
        <span className="font-medium text-neutral-500">Overall Progress</span>
        <span className="font-semibold text-neutral-950">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Overall progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-brand-100 mt-2 h-1.5 w-full overflow-hidden rounded-full"
      >
        <div className="bg-brand-deep h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="-mx-5 mt-5 border-t border-neutral-100" />
      <nav aria-label="Chapter steps" className="mt-4">
        <ol className="flex flex-col gap-1">
          {CHAPTER_STEPS.map((s, index) => {
            const active = s.key === step;
            return (
              <li key={s.key}>
                <Link
                  href={routes.learnModule(exam.slug, courseId, moduleId, s.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex items-center gap-3 rounded-md px-3 py-3.5 transition-colors', active ? 'bg-brand' : 'hover:bg-neutral-50')}
                >
                  <span
                    className={cx(
                      'flex size-11 shrink-0 items-center justify-center rounded-full font-semibold',
                      active ? 'bg-surface/20 text-on-brand' : 'bg-neutral-100 text-neutral-350',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cx('text-[15px] font-semibold', active ? 'text-on-brand' : 'text-neutral-950')}>{s.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}

/**
 * A chapter's step page: the chapter sidebar on desktop (a "Chapter Menu" drawer on mobile), the step itself,
 * and Prev / Next pinned to the bottom on small screens.
 */
export function ChapterScreen(props: ChapterProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { step } = props;
  useEffect(() => setMenuOpen(false), [step]);

  return (
    <div className="flex min-w-0 overflow-x-hidden">
      <div className="hidden min-h-[calc(100dvh-76px)] md:flex">
        <ChapterSidebar {...props} />
      </div>
      <div className="min-w-0 flex-1 p-2 pb-24 lg:pb-2">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="border-brand-75 bg-surface mb-3 flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold text-neutral-700 md:hidden"
        >
          <Menu aria-hidden className="size-4" />
          Chapter Menu
        </button>
        {menuOpen && (
          <div role="dialog" aria-modal="true" aria-label="Chapter menu" className="fixed inset-0 z-[110] md:hidden">
            <div className="bg-neutral-950/40 absolute inset-0" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="bg-surface absolute top-0 left-0 h-dvh w-80 max-w-[85vw] shadow-lg">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close chapter menu"
                className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
              >
                <X aria-hidden className="size-4" />
              </button>
              <ChapterSidebar {...props} />
            </div>
          </div>
        )}

        {step === 'video-lectures' && <VideoStep {...props} />}
        {step === 'study-notes' && <NotesStep {...props} />}
        {step === 'practice-questions' && <PracticeStep {...props} />}
        {step === 'chapter-pyq' && <ChapterPyqStep {...props} />}

        <div className="bg-canvas shadow-bar-up fixed inset-x-0 bottom-0 z-10 p-3 lg:hidden">
          <StepNav {...props} stretch />
        </div>
      </div>
    </div>
  );
}
