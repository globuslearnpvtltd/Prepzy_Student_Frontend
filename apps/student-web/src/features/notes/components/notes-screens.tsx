'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, Clock, Download, Menu, Play, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RichText } from '@/features/exam-engine/ui';
import { useLearnContext, useSubjectCourses, useSubjects } from '@/features/learn';
import { DidYouKnow, TwoColumn } from '@/features/learn/ui';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { notesApi, pdfDownloadUrl, type ChapterNotes } from '../api';
import styles from './notes-html.module.css';

const COURSE_FALLBACK = '/illustrations/tests/course.jpg';

function Failure({ title, error }: { title: string; error?: unknown }) {
  return (
    <div role="alert" className="border-danger/30 bg-danger-soft w-full rounded-xl border-2 p-6 text-sm">
      <p className="text-danger font-semibold">{title}</p>
      {error !== undefined && <p className="text-foreground-muted mt-1">{userMessage(error)}</p>}
    </div>
  );
}

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={!src || failed ? COURSE_FALLBACK : src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

/* ---------------------------------- /notes ---------------------------------- */

/** /[exam]/notes: pick a subject, then a book to read its chapter notes. */
export function NotesScreen({ aside }: { aside?: ReactNode }) {
  const exam = useExam();
  const { classId } = useLearnContext();
  const subjects = useSubjects(classId);
  const [picked, setPicked] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const subjectId = picked ?? subjects.data?.[0]?.id ?? null;
  const courses = useSubjectCourses(classId, subjectId);
  const selected = subjects.data?.find((s) => s.id === subjectId);
  const error = subjects.error ?? courses.error;

  return (
    <TwoColumn title="Notes" aside={aside}>
      {error ? (
        <Failure title="Failed To Load Notes" error={error} />
      ) : (
        <>
          <div role="group" aria-label="Subjects" className="border-brand-75 bg-surface hidden items-center gap-3 overflow-x-auto rounded-xl border-2 p-4 whitespace-nowrap md:flex">
            {subjects.isPending && classId !== null
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-28 rounded-full" />)
              : (subjects.data ?? []).map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    aria-pressed={subject.id === subjectId}
                    onClick={() => setPicked(subject.id)}
                    className={cx(
                      'rounded-full px-5 py-[11px] text-[14px] leading-[14px] font-semibold',
                      subject.id === subjectId ? 'bg-brand text-on-brand' : 'border-brand-75 bg-surface border-2 text-neutral-500',
                    )}
                  >
                    {subject.name}
                  </button>
                ))}
          </div>

          <div className="border-brand-75 bg-surface rounded-xl border-2 p-5 md:hidden">
            <p className="text-neutral-850 text-[16px] leading-4 font-semibold">Select Subject</p>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="border-brand bg-brand/20 text-brand mt-4 flex w-full items-center justify-between rounded-lg border-2 px-[18px] py-4 text-[14px] leading-[14px] font-semibold"
            >
              {selected?.name ?? 'Select subject'}
              <ChevronDown aria-hidden className={cx('size-5 transition-transform', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {(subjects.data ?? []).map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => {
                      setPicked(subject.id);
                      setMenuOpen(false);
                    }}
                    className={cx(
                      'rounded-lg border-2 px-[18px] py-4 text-left text-[14px] leading-[14px] font-semibold',
                      subject.id === subjectId ? 'bg-brand text-on-brand border-brand' : 'bg-canvas border-brand-75 text-neutral-900',
                    )}
                  >
                    {subject.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ul className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {courses.isPending && subjectId
              ? [0, 1, 2].map((i) => <Skeleton key={i} aria-hidden className="h-[240px] w-full rounded-xl" />)
              : (courses.data ?? []).map((course) => (
                  <li key={course.courseId} className="border-info-50 bg-surface flex h-full flex-col gap-2.5 rounded-xl border-2 p-2.5 transition-shadow hover:shadow-lg">
                    <span className="relative block h-[93px] overflow-hidden rounded-[14px] md:h-[113px]">
                      <Cover src={course.image} />
                    </span>
                    <span className="mb-2.5 flex flex-col gap-1.5 px-2.5 md:gap-3">
                      <span className="text-neutral-850 text-[16px] leading-6 font-semibold">{course.title}</span>
                      <span className="text-[14px] leading-[14px] font-medium text-neutral-450">{course.chapterCount} Chapters</span>
                      <Link
                        href={routes.notesView(exam.slug, course.courseId)}
                        aria-label={`View Notes: ${course.title}`}
                        className="border-brand-75 text-brand flex items-center justify-center gap-2 rounded-md border px-4 py-[15px] text-[14px] leading-[14px] font-semibold"
                      >
                        View Notes <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </span>
                  </li>
                ))}
          </ul>
        </>
      )}
      <DidYouKnow />
    </TwoColumn>
  );
}

/* -------------------------------- shared crumbs -------------------------------- */

function Crumbs({ crumbs, back, children }: { crumbs: { label: string; href?: string }[]; back: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link href={back} className="bg-surface flex shrink-0 items-center gap-2 rounded-xl px-3 py-[11px] text-sm font-semibold text-neutral-700 shadow-sm sm:px-4">
          <ArrowRight aria-hidden className="size-4 rotate-180" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <nav aria-label="Breadcrumb" className="bg-surface flex min-w-0 items-center gap-2 overflow-x-auto rounded-xl px-3 py-2.5 shadow-sm lg:px-4 lg:py-3.5">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2 text-sm whitespace-nowrap">
              {crumb.href ? (
                <Link href={crumb.href} className="text-brand font-bold hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cx('font-semibold', index === crumbs.length - 1 ? 'text-neutral-350' : 'text-brand')}>{crumb.label}</span>
              )}
              {index < crumbs.length - 1 && <span aria-hidden className="text-neutral-300">›</span>}
            </span>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------ /notes/[courseId] ------------------------------ */

function VideoCard({ note }: { note: ChapterNotes }) {
  const exam = useExam();
  const content = (
    <>
      <span
        className="relative flex h-[120px] items-center justify-center rounded-t-lg bg-cover bg-center"
        style={note.thumbnail ? { backgroundImage: `url(${note.thumbnail})` } : undefined}
      >
        <span className="bg-night-950/30 absolute inset-0 rounded-t-lg" />
        {note.videoReady ? (
          <span className="bg-surface relative z-10 flex size-[42px] items-center justify-center rounded-full shadow-card">
            <Play aria-hidden className="fill-brand text-brand size-4" />
          </span>
        ) : (
          <span className="bg-night-950/60 absolute inset-0 z-20 flex items-center justify-center rounded-t-lg">
            <span className="text-on-brand text-[12px] font-semibold tracking-wide">Coming Soon</span>
          </span>
        )}
      </span>
      <span className="flex flex-col gap-3 p-5">
        <span className="text-[16px] leading-[22px] font-semibold text-neutral-900">{note.moduleName} Summary Video</span>
        <span className="text-[12px] leading-4 text-neutral-900">Complete explanation with examples</span>
        <span className="flex items-center gap-2 text-[12px] font-medium text-neutral-900">
          <Clock aria-hidden className="size-3.5" />
          Duration: <span className="font-normal">_ _m _ _s</span>
        </span>
      </span>
    </>
  );
  const box = 'border-brand-75 bg-surface block rounded-lg border';
  return note.videoReady && note.noteId ? (
    <Link href={routes.summaryVideo(exam.slug, note.noteId)} className={cx(box, 'hover:shadow-card')}>
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className={cx(box, 'cursor-not-allowed opacity-60')}>
      {content}
    </div>
  );
}

/** Scrolls to a topic below the sticky header. */
function scrollToAnchor(anchorId: string) {
  const element = document.getElementById(anchorId);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - 100;
  window.scrollTo({ top, behavior: 'smooth' });
}

/** A book's chapter notes: chapter list with topics, the notes, PDF download and the summary video card. */
export function NotesViewScreen({ courseId }: { courseId: string }) {
  const exam = useExam();
  const searchParams = useSearchParams();
  const linkedModule = searchParams.get('module_id');
  const query = useQuery({ queryKey: ['notes', 'course', courseId], queryFn: () => notesApi.courseNotes(courseId) });
  const chapters = query.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(linkedModule);
  const [drawer, setDrawer] = useState(false);
  const active = chapters.find((c) => c.moduleId === activeId) ?? chapters.find((c) => c.moduleId === linkedModule) ?? chapters[0];

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  if (query.isError) return <div className="p-[30px]"><Failure title="Failed To Fetch Notes" error={query.error} /></div>;

  const canDownload = !!active?.notesReady && !!active.pdf;
  return (
    <div className="p-4 md:p-[30px]">
      {query.isPending ? (
        <div aria-busy="true" aria-label="Loading notes" className="flex w-full items-center gap-3">
          <Skeleton className="h-[46px] w-[46px] rounded-xl md:w-24" />
          <Skeleton className="h-[46px] flex-1 rounded-xl" />
        </div>
      ) : (
        <Crumbs
          back={routes.notes(exam.slug)}
          crumbs={[
            { label: 'Notes', href: routes.notes(exam.slug) },
            { label: active?.courseName ?? 'Course' },
            { label: active?.moduleName ?? 'Chapter' },
          ]}
        >
          {canDownload ? (
            <a
              href={pdfDownloadUrl(active.pdf!)}
              target="_blank"
              rel="noreferrer"
              aria-label="Download notes"
              className="bg-brand text-on-brand flex size-10 shrink-0 items-center justify-center gap-2 rounded-full md:h-auto md:w-auto md:rounded-lg md:px-4 md:py-2.5"
            >
              <Download aria-hidden className="size-4" />
              <span className="hidden text-[14px] leading-5 font-semibold md:inline">Download</span>
            </a>
          ) : (
            <span aria-disabled="true" aria-label="Download notes" className="bg-brand text-on-brand flex size-10 shrink-0 items-center justify-center gap-2 rounded-full opacity-50 md:h-auto md:w-auto md:rounded-lg md:px-4 md:py-2.5">
              <Download aria-hidden className="size-4" />
              <span className="hidden text-[14px] leading-5 font-semibold md:inline">Download</span>
            </span>
          )}
        </Crumbs>
      )}

      <div className="relative mt-4 flex w-full flex-col gap-5 md:mt-[18px] md:flex-row md:items-start">
        {drawer && <div onClick={() => setDrawer(false)} className="bg-night-950/40 fixed inset-0 z-40 md:hidden" />}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="border-brand-75 bg-surface flex w-full items-center justify-between rounded-lg border px-5 py-4 shadow-sm md:hidden"
        >
          <span className="text-[20px] font-bold text-neutral-800">All Chapters</span>
          <Menu aria-hidden className="size-7 text-neutral-800" />
        </button>

        <aside
          aria-label="Chapters"
          className={cx(
            'bg-surface fixed top-[70px] left-0 z-50 h-[calc(100dvh-70px)] w-[85%] max-w-[360px] overflow-y-auto overscroll-contain transition-transform duration-300',
            drawer ? 'translate-x-0' : '-translate-x-full',
            'md:sticky md:top-[96px] md:z-10 md:h-auto md:max-h-[calc(100vh-116px)] md:w-[25%] md:shrink-0 md:translate-x-0 md:rounded-lg md:border-b md:border-brand-75',
          )}
        >
          <div className="border-brand-75 bg-surface sticky top-0 z-10 flex flex-col gap-2.5 border p-5 md:rounded-t-lg">
            {active?.courseName && (
              <span className="bg-brand text-on-brand hidden w-fit rounded-full px-3 py-2.5 text-[12px] leading-[14px] font-semibold md:block">
                {active.courseName}
              </span>
            )}
            <div className="flex items-center justify-between">
              <p className="text-[20px] leading-5 font-bold text-neutral-800">All Chapters</p>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close chapters" className="md:hidden">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          </div>
          {!query.isPending && chapters.length === 0 ? (
            <p className="p-[30px] text-[16px] text-neutral-800">No Chapters To Show...</p>
          ) : (
            chapters.map((chapter) => {
              const open = expanded === chapter.moduleId;
              return (
                <div key={chapter.moduleId} className="border-brand-75 border-b">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => {
                      setExpanded(open ? null : chapter.moduleId);
                      if (active?.moduleId !== chapter.moduleId) {
                        setActiveId(chapter.moduleId);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="border-brand-75 bg-surface flex w-full items-center justify-between border-x p-5 text-left"
                  >
                    <span className="flex flex-col gap-2.5">
                      <span className="text-[12px] text-neutral-800">Chapter {chapter.moduleOrder}</span>
                      <span className="text-[20px] font-bold text-neutral-800">{chapter.moduleName}</span>
                    </span>
                    <ChevronDown aria-hidden className={cx('size-6 shrink-0 text-neutral-900/70 transition-transform', open && 'rotate-180')} />
                  </button>
                  {open && chapter.topics.length > 0 && (
                    <ul className="border-brand-75 bg-canvas border-x border-b">
                      {chapter.topics.map((topic) => (
                        <li key={topic.anchorId}>
                          <button
                            type="button"
                            onClick={() => {
                              scrollToAnchor(topic.anchorId);
                              setDrawer(false);
                            }}
                            className="hover:bg-brand-50 border-learn-line w-full border-b px-5 py-[18px] text-left text-[15px] text-neutral-900 last:border-b-0"
                          >
                            {topic.topic}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </aside>

        <div className="flex w-full min-w-0 flex-col gap-[22px] md:w-[55%]">
          <div className="border-brand-75 bg-surface flex flex-col gap-4 rounded-xl border p-[30px]">
            {query.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-[16px] leading-4 text-neutral-800">Chapter {active?.moduleOrder}</p>
                <h1 className="text-brand text-[40px] leading-10 font-bold">{active?.moduleName}</h1>
                {active?.description && <p className="text-[14px] leading-5 text-neutral-700 italic">{active.description}</p>}
              </>
            )}
          </div>
          <div className="border-brand-75 bg-surface overflow-x-auto rounded-xl border p-[30px]">
            {query.isPending ? null : active?.notesReady && active.html ? (
              <RichText key={active.moduleId} html={active.html} className={styles.notes} />
            ) : (
              <p className="text-[16px] leading-4 text-neutral-800">Notes Not Ready Yet...</p>
            )}
          </div>
        </div>

        {active && (
          <div className="w-full md:sticky md:top-[96px] md:w-[20%] md:shrink-0">
            <VideoCard note={active} />
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- /notes/video/[noteId] --------------------------- */

/** A chapter's summary video with its narration as the transcript. */
export function SummaryVideoScreen({ noteId }: { noteId: string }) {
  const exam = useExam();
  const query = useQuery({ queryKey: ['notes', 'summary-video', noteId], queryFn: () => notesApi.summaryVideo(noteId) });
  const video = query.data;
  if (query.isError) return <div className="p-[30px]"><Failure title="Failed To Fetch Summary Video" error={query.error} /></div>;
  return (
    <div className="p-4 md:p-[30px]">
      <Crumbs
        back={routes.notes(exam.slug)}
        crumbs={[
          { label: 'Notes', href: routes.notes(exam.slug) },
          { label: video?.courseName || 'Course' },
          { label: video?.moduleName || 'Chapter' },
          { label: 'Summary video' },
        ]}
      />
      <div className="mt-4 flex w-full flex-col gap-5 md:mt-[18px] md:flex-row">
        <p className="text-[16px] leading-4 font-semibold text-neutral-800 md:hidden">{video?.moduleName} Summary Video</p>
        <div className="flex w-full flex-col gap-5 md:w-[65%]">
          <div className="bg-neutral-900/60 flex h-[194px] w-full items-center justify-center overflow-hidden rounded-xl md:h-[506px]">
            {query.isPending ? (
              <Skeleton className="h-full w-full" />
            ) : video?.videoUrl ? (
              <video
                src={video.videoUrl}
                poster={video.thumbnail ?? undefined}
                aria-label={`${video.moduleName} summary video`}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                className="h-full w-full object-cover"
              />
            ) : (
              <p className="text-on-brand">No video available</p>
            )}
          </div>
          <div className="border-brand-75 bg-surface hidden flex-col gap-4 rounded-xl border p-8 md:flex">
            <p className="text-[16px] leading-4 text-neutral-800">Chapter {video?.moduleOrder}</p>
            <h1 className="text-brand text-[40px] leading-10 font-bold">{video?.moduleName}</h1>
            {video?.description && <p className="text-[14px] leading-5 text-neutral-700 italic">{video.description}</p>}
          </div>
        </div>
        <section aria-labelledby="transcript-title" className="w-full md:w-[35%]">
          <h2 id="transcript-title" className="border-brand-75 bg-surface rounded-t-lg border px-5 py-7 text-[20px] leading-5 font-semibold text-neutral-900">
            Transcript
          </h2>
          <ol className="h-[500px] overflow-y-auto">
            {(video?.narrations ?? []).map((narration, index) => (
              <li key={index} className="border-brand-75 bg-surface border-x border-b p-5 text-[14px] font-medium text-neutral-950 md:text-[16px] md:leading-[22px]">
                {narration}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
