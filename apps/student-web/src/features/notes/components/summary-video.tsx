'use client';

import { Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { notesApi } from '../api';
import { Crumbs, Failure } from './parts';

/** /[exam]/notes/video/[noteId]: a chapter's summary video with its narration as the transcript. */
export function SummaryVideoScreen({ noteId }: { noteId: string }) {
  const exam = useExam();
  const query = useQuery({ queryKey: ['notes', 'summary-video', noteId], queryFn: () => notesApi.summaryVideo(noteId) });
  const video = query.data;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1440px] p-4 md:p-8">
        <Failure title="Failed To Fetch Summary Video" error={query.error} />
      </div>
    );
  }
  const narrations = video?.narrations ?? [];
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-10 md:px-8 md:pt-6">
      <Crumbs
        back={routes.notes(exam.slug)}
        crumbs={[
          { label: 'Notes', href: routes.notes(exam.slug) },
          { label: video?.courseName || 'Course' },
          { label: video?.moduleName || 'Chapter' },
          { label: 'Summary video' },
        ]}
      />
      <div className="mt-4 grid grid-cols-1 gap-5 md:mt-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <div className="bg-night-950 flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl">
            {query.isPending ? (
              <Skeleton className="h-full w-full" />
            ) : video?.videoUrl ? (
              <video
                src={video.videoUrl}
                poster={video.thumbnail ?? undefined}
                aria-label={`${video.moduleName} summary video`}
                controls
                playsInline
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="text-on-brand text-sm">No video available</p>
            )}
          </div>
          <div className="bg-surface border-learn-line flex flex-col gap-1.5 rounded-2xl border p-4 md:gap-2 md:p-7">
            {query.isPending ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <>
                <p className="text-[11px] font-medium tracking-[0.06em] text-neutral-500 uppercase md:text-[12px]">
                  {[video?.courseName, video?.moduleOrder ? `Chapter ${video.moduleOrder}` : null, 'Summary video'].filter(Boolean).join(' · ')}
                </p>
                <h1 className="text-brand text-[18px] leading-6 font-bold md:text-[28px] md:leading-9">{video?.moduleName}</h1>
                {video?.description && <p className="text-[13px] leading-5 text-neutral-600 md:text-[14px]">{video.description}</p>}
              </>
            )}
          </div>
        </div>
        <section
          aria-labelledby="transcript-title"
          className="bg-surface border-learn-line flex flex-col overflow-hidden rounded-2xl border lg:sticky lg:top-[100px] lg:max-h-[calc(100dvh-124px)]"
        >
          <h2 id="transcript-title" className="border-learn-line border-b px-5 py-4 text-[16px] leading-6 font-semibold text-neutral-900 md:text-[18px]">
            Transcript
          </h2>
          {narrations.length === 0 ? (
            <p className="text-neutral-550 px-5 py-6 text-[14px]">{query.isPending ? 'Loading transcript…' : 'No transcript for this video.'}</p>
          ) : (
            <ol className="divide-learn-line max-h-[420px] divide-y overflow-y-auto overscroll-contain lg:max-h-none">
              {narrations.map((narration, index) => (
                <li key={index} className="px-5 py-4 text-[14px] leading-6 text-neutral-800 md:text-[15px]">
                  {narration}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
