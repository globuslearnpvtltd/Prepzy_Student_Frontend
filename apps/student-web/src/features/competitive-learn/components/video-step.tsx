'use client';

import { cx } from '@prepzy/design-system';
import { useState } from 'react';
import { LectureAtlas } from '@/features/assistant/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { useChapter, useMarkComplete, useSummaryVideo } from '../hooks';
import type { ChapterProps } from './chapter-screen';
import { Breadcrumb, ComingSoon, ErrorCard, StepNav } from './kit';
import { VideoPlayer } from './video-player';

/** Step 1: the chapter's summary video, in parts and languages, with "Mark As Completed". */
export function VideoStep({ courseId, moduleId, step }: ChapterProps) {
  const exam = useExam();
  const chapter = useChapter(moduleId).data;
  const video = useSummaryVideo(moduleId);
  const complete = useMarkComplete('video', moduleId);
  const parts = video.data?.parts ?? [];
  const [pickedPart, setPickedPart] = useState<string | null>(null);
  const [pickedLanguage, setPickedLanguage] = useState<string | null>(null);

  const part = parts.find((p) => p.label === pickedPart) ?? parts[0];
  const source = part?.sources.find((s) => s.language === pickedLanguage) ?? part?.sources[0];
  const done = !!video.data?.completed || complete.isSuccess;
  const markDone = () => {
    if (!done && !complete.isPending && parts.length > 0) complete.mutate();
  };

  const courseHref = routes.learnCourse(exam.slug, courseId);
  const completedButton = parts.length > 0 && (
    <button
      type="button"
      onClick={markDone}
      disabled={complete.isPending || done}
      className={cx(
        'shrink-0 rounded-lg px-4 py-2.5 text-[13px] font-semibold disabled:cursor-not-allowed',
        done ? 'bg-success-100 text-success-700' : 'bg-brand text-on-brand disabled:opacity-60',
      )}
    >
      {done ? 'Completed' : complete.isPending ? 'Marking...' : 'Mark As Completed'}
    </button>
  );

  return (
    <div className="bg-surface rounded-lg border border-neutral-100 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          crumbs={[
            { label: chapter?.subject || 'Subject', href: courseHref },
            { label: chapter?.title || 'Chapter', href: courseHref },
            { label: 'Video Lecture' },
          ]}
          backHref={courseHref}
          className="lg:flex-1"
          right={
            <div className="hidden items-center gap-4 lg:flex">
              {completedButton}
              <span className="h-8 w-px bg-neutral-200" />
              <StepNav courseId={courseId} moduleId={moduleId} step={step} />
            </div>
          }
        />
        <div className="lg:hidden">{completedButton}</div>
      </div>

      {parts.length > 1 && (
        <div role="tablist" aria-label="Video parts" className="mt-4 flex flex-wrap gap-2">
          {parts.map((p) => (
            <button
              key={p.label}
              type="button"
              role="tab"
              aria-selected={p.label === part?.label}
              onClick={() => setPickedPart(p.label)}
              className={cx(
                'rounded-full px-4 py-2 text-[13px] font-semibold transition',
                p.label === part?.label ? 'bg-brand text-on-brand' : 'border-brand-75 bg-surface text-brand border',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {video.isError ? (
        <div className="mt-4">
          <ErrorCard title="Failed to load the video" error={video.error} />
        </div>
      ) : video.isPending ? (
        <div aria-busy="true" aria-label="Loading" className="bg-neutral-100 mt-4 aspect-video w-full max-w-[1200px] animate-pulse rounded-lg" />
      ) : part && source ? (
        <div className="mx-auto mt-4 aspect-square w-[380px] max-w-full md:mx-0 md:aspect-video md:w-full md:max-w-[1200px]">
          <VideoPlayer
            key={part.label}
            url={source.url}
            title={source.title}
            languages={part.sources.map((s) => s.language)}
            language={source.language}
            onLanguageChange={setPickedLanguage}
            onEnded={markDone}
          />
        </div>
      ) : (
        <ComingSoon
          title="Video Coming Soon!"
          className="border-brand-75 mt-4 rounded-lg border"
          icon={
            <svg aria-hidden width="44" height="44" viewBox="0 0 48 48" fill="none" className="stroke-brand" strokeWidth="2" strokeLinejoin="round">
              <rect x="6" y="12" width="28" height="24" rx="4" />
              <path d="M34 20L42 15V33L34 28" strokeLinecap="round" />
              <path d="M17 20L23 24L17 28V20Z" className="fill-brand" />
            </svg>
          }
        >
          Our academic team is putting together video lectures for{' '}
          <span className="font-semibold text-neutral-700">{video.data?.title || 'this chapter'}</span>. Check back shortly — great
          lectures take a little time!
        </ComingSoon>
      )}
      {/* The chapter tutor (Atlas scoped to the course), as on the previous app's video step. */}
      <LectureAtlas courseId={courseId} moduleId={moduleId} />
    </div>
  );
}
