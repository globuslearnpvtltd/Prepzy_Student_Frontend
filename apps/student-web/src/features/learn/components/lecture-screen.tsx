'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Languages } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { LectureAtlas } from '@/features/assistant/ui';
import { RichText } from '@/features/exam-engine/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { activityHref, formatTitle, learnApi, resolveVideoSource, titleCase, type Activity, type LectureVideo } from '../api';
import { learnKeys, useCourseOutline } from '../hooks';
import { Breadcrumb, SectionError } from './kit';

/** Same key as the previous app, so a student's language choice carries over. */
export const LANGUAGE_KEY = 'cbse_video_language';

function readLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

/** The video in the student's language (remembered across lectures), else the first one. */
export function pickVideo(videos: LectureVideo[], language: string | null): LectureVideo | null {
  return videos.find((video) => video.language === language) ?? videos[0] ?? null;
}

const capitalize = (value: string) => (value ? value[0]!.toUpperCase() + value.slice(1) : value);

/** Light player: YouTube embed, or the browser's player for direct / HeyGen files; language switch below. */
export function LecturePlayer({ videos, title, onError }: { videos: LectureVideo[]; title: string; onError: () => void }) {
  const [language, setLanguage] = useState<string | null>(readLanguage);
  const video = pickVideo(videos, language);
  const source = resolveVideoSource(video?.link);
  const languages = videos.filter((v) => v.language);

  const choose = (value: string) => {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      // Private mode: the choice still applies to this lecture.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-night-950 relative mx-auto h-[250px] w-full overflow-hidden rounded-md md:h-[485px]">
        {source?.kind === 'youtube' ? (
          <iframe
            key={source.url}
            src={source.url}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : source ? (
          <video
            key={source.url}
            src={source.url}
            aria-label={title}
            controls
            controlsList="nodownload"
            playsInline
            onError={onError}
            onContextMenu={(event) => event.preventDefault()}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : null}
      </div>
      {languages.length > 1 && (
        <div role="group" aria-label="Video language" className="flex flex-wrap items-center gap-2">
          <Languages aria-hidden className="text-learn-muted size-4" />
          {languages.map((item) => (
            <button
              key={item.language}
              type="button"
              aria-pressed={item === video}
              onClick={() => choose(item.language)}
              className={cx(
                'rounded-full border px-3 py-1 text-[12px] font-semibold',
                item === video ? 'bg-brand border-brand text-on-brand' : 'border-learn-line-strong text-learn-ink bg-surface',
              )}
            >
              {capitalize(item.language)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NoVideos() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <Image src="/illustrations/learn/no-videos.png" alt="" width={400} height={300} className="h-auto w-[400px] max-w-full" />
      <p className="text-center text-[20px] font-bold text-neutral-950 md:text-[30px]">
        Our academic experts are putting the finishing touches on this lecture. It&apos;ll be live very soon!
      </p>
    </div>
  );
}

/** A lecture: player, description / transcript, and Previous / Next through the course. */
export function LectureScreen({ courseId, moduleId, lectureId }: { courseId: string; moduleId: string; lectureId: string }) {
  const exam = useExam();
  const router = useRouter();
  const queryClient = useQueryClient();
  const lecture = useQuery({ queryKey: learnKeys.lecture(lectureId), queryFn: () => learnApi.lecture(lectureId) });
  const transcript = useQuery({ queryKey: learnKeys.transcript(lectureId), queryFn: () => learnApi.transcript(lectureId) });
  const outline = useCourseOutline(courseId);
  const [tab, setTab] = useState<'description' | 'transcript'>('description');
  const [refreshed, setRefreshed] = useState<LectureVideo[] | null>(null);
  const refreshTried = useRef(false);

  const go = (activity: Activity | null) => {
    if (activity) router.push(activityHref(exam.slug, courseId, activity));
  };
  const next = useMutation({
    mutationFn: () => learnApi.completeLecture(courseId, lectureId),
    onSuccess: (activity) => {
      void queryClient.invalidateQueries({ queryKey: learnKeys.all });
      if (activity) go(activity);
      else router.push(routes.boardModule(exam.slug, courseId, moduleId));
    },
  });
  const previous = useMutation({ mutationFn: () => learnApi.previousActivity(courseId, lectureId), onSuccess: go });

  const onVideoError = () => {
    if (refreshTried.current) return;
    refreshTried.current = true;
    learnApi
      .refreshVideos(lectureId)
      .then((videos) => videos && setRefreshed(videos))
      .catch(() => undefined);
  };

  if (lecture.isError) return <SectionError title="Failed To Fetch Lecture Data" error={lecture.error} />;

  const chapters = outline.data?.chapters ?? [];
  const chapterIndex = chapters.findIndex((c) => c.id === moduleId);
  const chapterHref = routes.boardModule(exam.slug, courseId, moduleId, 'learn');
  const title = lecture.data?.title ?? '';
  const videos = refreshed ?? lecture.data?.videos ?? [];
  const busy = next.isPending || previous.isPending;
  const failure = next.error ?? previous.error;

  const navButton = 'text-brand flex items-center gap-1 text-[14px] leading-[14px] font-medium disabled:opacity-50';
  const mobileButton = 'text-brand flex items-center rounded-[6px] border-[1.5px] border-line px-5 py-2 text-[14px] leading-[14px] font-medium disabled:opacity-50';

  return (
    <div className="flex flex-col pb-[90px] md:mt-4">
      <nav aria-label="Lecture navigation" className="flex items-center justify-between gap-3 px-2">
        <Breadcrumb
          backHref={chapterHref}
          crumbs={[
            { label: 'Learn', href: routes.learn(exam.slug) },
            ...(outline.data?.course ? [{ label: titleCase(outline.data.course.subjectName) }] : []),
            ...(chapterIndex >= 0 ? [{ label: `Ch ${chapterIndex + 1}: ${formatTitle(chapters[chapterIndex]!.title)}`, href: chapterHref }] : []),
            { label: formatTitle(title || 'Lecture') },
          ]}
        />
        <div className="hidden gap-6 md:flex">
          <button type="button" onClick={() => previous.mutate()} disabled={busy} className={navButton}>
            <ChevronLeft aria-hidden className="size-3.5" />
            Previous
          </button>
          <button type="button" onClick={() => next.mutate()} disabled={busy} className={navButton}>
            Next
            <ChevronRight aria-hidden className="size-3.5" />
          </button>
        </div>
      </nav>

      {failure && (
        <p role="alert" className="text-danger mt-3 px-2 text-sm">
          {userMessage(failure)}
        </p>
      )}

      {lecture.isPending ? (
        <div aria-busy="true" aria-label="Loading lecture" className="mt-4 flex flex-col gap-4 px-2">
          <Skeleton className="h-[250px] w-full rounded-md md:h-[485px]" />
          <Skeleton className="h-6 w-1/3" />
        </div>
      ) : videos.length === 0 ? (
        <NoVideos />
      ) : (
        <div className="mx-auto w-full max-w-[1200px] px-2 py-2">
          <LecturePlayer videos={videos} title={titleCase(title)} onError={onVideoError} />
          <p className="mt-4 hidden text-sm text-neutral-600 md:block">
            *If you have any doubt with the narration please refer transcript.
          </p>
          <div role="tablist" aria-label="Lecture details" className="mt-2.5 flex gap-8 border-b border-neutral-200 text-sm font-medium">
            {(['description', 'transcript'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cx('px-1 py-2', tab === key ? 'text-info border-info border-b-2' : 'text-neutral-550 hover:text-neutral-700')}
              >
                {key === 'description' ? 'Description' : 'Transcript'}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-4 max-h-[200px] overflow-y-auto text-sm text-neutral-700">
            {tab === 'description' ? (
              <p>{lecture.data.description}</p>
            ) : transcript.data ? (
              <RichText html={transcript.data} />
            ) : (
              <p>No transcript currently available</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-surface fixed right-0 bottom-0 z-20 flex h-[50px] w-full items-center justify-between border-t-2 border-line px-6 md:hidden">
        <button type="button" onClick={() => previous.mutate()} disabled={busy} className={mobileButton}>
          <ChevronLeft aria-hidden className="size-3" />
          Previous
        </button>
        <button type="button" onClick={() => next.mutate()} disabled={busy} className={mobileButton}>
          Next
          <ChevronRight aria-hidden className="size-3" />
        </button>
      </div>
      {/* The lecture tutor (Atlas scoped to the course). */}
      <LectureAtlas courseId={courseId} moduleId={moduleId} lectureId={lectureId} />
    </div>
  );
}
