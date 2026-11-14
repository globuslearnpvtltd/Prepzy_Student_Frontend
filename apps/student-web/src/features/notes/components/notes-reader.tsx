'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Download, ListOrdered, Loader2, Play, RotateCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { notesApi, pdfDownloadUrl, type ChapterNotes } from '../api';
import { prepareNotes, type NoteSection } from '../document';
import { NotesContent } from './notes-content';
import { BottomSheet, Crumbs, Failure, NumberedOption } from './parts';

/** Distance from the top of the viewport where a section counts as "being read": below the fixed header. */
const READ_LINE = 120;

const headerOffset = () => (window.matchMedia?.('(min-width: 768px)').matches ? 76 : 70) + 20;

/** Scrolls a section's start just below the fixed header. */
function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - headerOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** Scroll-spy: the last section whose start has scrolled past the read line (the first one before that). */
function useActiveSection(sections: readonly NoteSection[]) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    if (ids.length === 0) {
      setActive(null);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0]!;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= READ_LINE) current = id;
      }
      // At the very end of the page the last section is the one being read, even if its start never reaches the line.
      const page = document.documentElement;
      if (page.scrollHeight > window.innerHeight && window.innerHeight + window.scrollY >= page.scrollHeight - 2) {
        current = ids[ids.length - 1]!;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return [active, setActive] as const;
}

type DownloadState = 'idle' | 'busy' | 'failed';

const fileName = (note: ChapterNotes) =>
  `${[note.courseName, note.moduleName].filter(Boolean).join(' - ') || 'Chapter notes'}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');

/**
 * Downloads the chapter's PDF as a file. The PDF is fetched and saved, so a failure can be shown and retried: offline,
 * or the server answering with an error. If the file host doesn't allow the page to read the file (a network error while
 * online), the browser is sent to the download link instead (the CDN serves it as an attachment, so the page stays).
 */
function usePdfDownload(note: ChapterNotes) {
  const [state, setState] = useState<DownloadState>('idle');

  const download = useCallback(async () => {
    if (!note.pdf) return;
    const url = pdfDownloadUrl(note.pdf);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState('failed');
      return;
    }
    setState('busy');
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      setState('idle');
      window.location.assign(url);
      return;
    }
    try {
      if (!response.ok) throw new Error(`PDF download failed (${response.status})`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = fileName(note);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setState('idle');
    } catch {
      setState('failed');
    }
  }, [note]);

  return { state, download };
}

function DownloadButton({ note }: { note: ChapterNotes }) {
  const { state, download } = usePdfDownload(note);
  const failed = state === 'failed';
  return (
    <button
      type="button"
      onClick={download}
      disabled={state === 'busy'}
      aria-live="polite"
      className={cx(
        'bg-surface flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[13px] leading-5 font-semibold transition-colors lg:w-auto lg:shrink-0 lg:px-5',
        failed ? 'border-accent-300 text-accent-800 hover:bg-accent-50' : 'border-learn-line-strong text-neutral-900 hover:bg-brand-50',
        state === 'busy' && 'cursor-progress opacity-80',
      )}
    >
      {state === 'busy' ? (
        <Loader2 aria-hidden className="text-brand size-[18px] shrink-0 animate-spin" />
      ) : failed ? (
        <RotateCw aria-hidden className="text-accent-500 size-[18px] shrink-0" />
      ) : (
        <Download aria-hidden className="text-brand size-[18px] shrink-0" />
      )}
      {state === 'busy' ? 'Downloading notes…' : failed ? 'Could not download · tap to try again' : 'Download notes (PDF)'}
    </button>
  );
}

function VideoCard({ note }: { note: ChapterNotes }) {
  const exam = useExam();
  const ready = note.videoReady && !!note.noteId;
  const content = (
    <>
      <span
        className="bg-brand-100 relative flex aspect-video w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center md:w-[160px]"
        style={note.thumbnail ? { backgroundImage: `url(${note.thumbnail})` } : undefined}
      >
        <span className="bg-night-950/25 absolute inset-0" />
        {ready ? (
          <span className="bg-surface shadow-card relative flex size-9 items-center justify-center rounded-full">
            <Play aria-hidden className="fill-brand text-brand size-3.5" />
          </span>
        ) : (
          <span className="bg-night-950/55 text-on-brand absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-wide">
            Coming Soon
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-brand text-[11px] font-semibold tracking-wide uppercase">Summary video</span>
        <span className="text-[14px] leading-5 font-semibold text-neutral-900 md:text-[15px]">{note.moduleName} Summary Video</span>
        <span className="text-neutral-550 text-[12px] leading-4">Complete explanation with examples</span>
      </span>
    </>
  );
  const box = 'bg-surface border-learn-line flex items-center gap-4 rounded-2xl border p-3 md:p-4';
  return ready ? (
    <Link href={routes.summaryVideo(exam.slug, note.noteId)} className={cx(box, 'hover:border-brand-200 hover:shadow-card transition-shadow')}>
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" className={cx(box, 'opacity-70')}>
      {content}
    </div>
  );
}

/** "On this page" index beside the notes on wide screens, following the reader as they scroll. */
function SectionIndex({ sections, active, onSelect }: { sections: NoteSection[]; active: string | null; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Chapter contents" className="flex flex-col gap-3">
      <p className="text-[12px] font-semibold tracking-wide text-neutral-500 uppercase">On this page</p>
      <ol className="border-learn-line flex flex-col border-l-2">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={section.id === active ? 'true' : undefined}
              className={cx(
                '-ml-0.5 w-full border-l-2 py-1.5 pr-2 pl-4 text-left text-[13px] leading-5 transition-colors',
                section.id === active ? 'border-brand text-brand font-semibold' : 'border-transparent text-neutral-600 hover:text-neutral-900',
              )}
            >
              {section.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * /[exam]/notes/[courseId]: a book's chapter notes.
 * - Phones (and tablets): the chapter card (switch chapter from its chevron), "Contents" opens the chapter's index in a
 *   bottom sheet, the PDF download (only when the chapter has a PDF), the notes, and Previous / Next fixed at the bottom.
 * - lg: the chapter list on the left; from xl the index sits on the right and highlights the section being read.
 */
export function NotesViewScreen({ courseId }: { courseId: string }) {
  const exam = useExam();
  const searchParams = useSearchParams();
  const linkedModule = searchParams.get('module_id');
  const query = useQuery({ queryKey: ['notes', 'course', courseId], queryFn: () => notesApi.courseNotes(courseId) });
  const chapters = useMemo(() => query.data ?? [], [query.data]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'chapters' | 'contents' | null>(null);

  const index = Math.max(
    0,
    chapters.findIndex((c) => c.moduleId === (activeId ?? linkedModule)),
  );
  const active = chapters[index];
  const previous = index > 0 ? chapters[index - 1] : undefined;
  const next = chapters[index + 1];

  const readable = !!active?.notesReady && !!active.html;
  const doc = useMemo(() => (readable && active ? prepareNotes(active.html, active.topics) : { html: '', sections: [], css: '', fonts: [] }), [readable, active]);
  const [activeSection, setActiveSection] = useActiveSection(doc.sections);

  const openChapter = (chapter: ChapterNotes) => {
    setSheet(null);
    if (chapter.moduleId === active?.moduleId) return;
    setActiveId(chapter.moduleId);
    // Keep the chapter in the address so a refresh or a shared link opens it.
    window.history.replaceState(window.history.state, '', routes.notesView(exam.slug, courseId, chapter.moduleId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToSection = (id: string) => {
    setActiveSection(id);
    if (sheet) {
      setSheet(null);
      // Wait for the sheet to release the page's scroll lock.
      requestAnimationFrame(() => scrollToSection(id));
    } else scrollToSection(id);
  };

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1440px] p-4 md:p-8">
        <Failure title="Failed To Fetch Notes" error={query.error} />
      </div>
    );
  }

  const total = chapters.length;
  const position = `${active?.courseName ? `${active.courseName} · ` : ''}Chapter ${index + 1} of ${total}`;
  const hasIndex = doc.sections.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 pb-28 md:px-8 lg:pt-6 lg:pb-12">
      <Crumbs
        className="mb-6 hidden lg:flex"
        back={routes.notes(exam.slug)}
        crumbs={[
          { label: 'Notes', href: routes.notes(exam.slug) },
          { label: active?.courseName || 'Course' },
          { label: active?.moduleName || 'Chapter' },
        ]}
      />

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[272px_minmax(0,1fr)_232px]">
        {/* Chapter list (lg+) */}
        <aside aria-label="Chapters" className="sticky top-[100px] hidden max-h-[calc(100dvh-124px)] flex-col overflow-hidden rounded-2xl border border-learn-line bg-surface lg:flex">
          <div className="border-learn-line border-b px-5 py-4">
            {active?.courseName && <p className="text-brand text-[12px] font-semibold tracking-wide uppercase">{active.courseName}</p>}
            <p className="mt-0.5 text-[16px] font-bold text-neutral-900">All Chapters</p>
          </div>
          {!query.isPending && total === 0 ? (
            <p className="p-5 text-[14px] text-neutral-700">No Chapters To Show...</p>
          ) : (
            <ol className="flex flex-col overflow-y-auto p-2">
              {query.isPending
                ? [0, 1, 2, 3].map((i) => (
                    <li key={i} aria-hidden="true">
                      <Skeleton className="m-2 h-12 rounded-lg" />
                    </li>
                  ))
                : chapters.map((chapter, i) => {
                    const current = chapter.moduleId === active?.moduleId;
                    return (
                      <li key={chapter.moduleId}>
                        <button
                          type="button"
                          onClick={() => openChapter(chapter)}
                          aria-current={current ? 'true' : undefined}
                          className={cx(
                            'flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                            current ? 'bg-brand-75' : 'hover:bg-neutral-100',
                          )}
                        >
                          <span className={cx('text-[11px] font-medium', current ? 'text-brand' : 'text-neutral-500')}>Chapter {i + 1}</span>
                          <span className={cx('text-[14px] leading-5 font-semibold', current ? 'text-brand' : 'text-neutral-900')}>
                            {chapter.moduleName}
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ol>
          )}
        </aside>

        {/* The notes */}
        <div className="mx-auto flex w-full max-w-[780px] min-w-0 flex-col gap-4 lg:gap-5">
          {query.isPending ? (
            <div aria-busy="true" aria-label="Loading notes" className="flex flex-col gap-4">
              <Skeleton className="h-[62px] w-full rounded-2xl lg:h-[110px]" />
              <Skeleton className="h-[320px] w-full rounded-2xl" />
            </div>
          ) : total === 0 ? (
            <p className="bg-surface border-learn-line rounded-2xl border p-6 text-[15px] text-neutral-800 lg:hidden">No Chapters To Show...</p>
          ) : (
            active && (
              <>
                <header className="bg-surface border-learn-line flex items-center gap-2 rounded-2xl border px-3 py-3 lg:px-7 lg:py-6">
                  <Link href={routes.notes(exam.slug)} aria-label="Back to notes" className="hover:bg-neutral-100 shrink-0 rounded-full p-1 text-neutral-700 lg:hidden">
                    <ChevronLeft aria-hidden className="size-5" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] leading-4 font-medium tracking-[0.06em] text-neutral-500 uppercase lg:text-[12px]">{position}</p>
                    <h1 className="text-[15px] leading-5 font-bold text-neutral-950 lg:text-brand lg:mt-1 lg:text-[30px] lg:leading-9">{active.moduleName}</h1>
                    {active.description && <p className="mt-2 hidden text-[14px] leading-5 text-neutral-600 lg:block">{active.description}</p>}
                  </div>
                  {total > 1 && (
                    <button
                      type="button"
                      onClick={() => setSheet('chapters')}
                      aria-label="Switch chapter"
                      aria-haspopup="dialog"
                      className="hover:bg-neutral-100 shrink-0 rounded-full p-1 text-neutral-700 lg:hidden"
                    >
                      <ChevronDown aria-hidden className="size-5" />
                    </button>
                  )}
                </header>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[16px] leading-6 font-bold text-neutral-950 lg:text-[18px]">Chapter notes</h2>
                    {hasIndex && (
                      <button
                        type="button"
                        onClick={() => setSheet('contents')}
                        aria-haspopup="dialog"
                        className="border-learn-line-strong text-brand hover:bg-brand-50 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold xl:hidden"
                      >
                        <ListOrdered aria-hidden className="size-4" />
                        Contents
                        <span className="text-neutral-500 font-medium">· {doc.sections.length}</span>
                      </button>
                    )}
                  </div>
                  {readable && active.pdf && <DownloadButton key={active.moduleId} note={active} />}
                </div>

                <article aria-label={`${active.moduleName} notes`} className="bg-surface border-learn-line rounded-2xl border px-4 py-5 md:px-8 md:py-8">
                  {readable ? (
                    <NotesContent key={active.moduleId} doc={doc} />
                  ) : (
                    <p className="text-[15px] text-neutral-800">Notes Not Ready Yet...</p>
                  )}
                </article>

                <VideoCard note={active} />

                <nav
                  aria-label="Chapter navigation"
                  className="bg-surface border-learn-line fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0"
                >
                  <ChapterStep chapter={previous} direction="previous" onOpen={openChapter} />
                  <ChapterStep chapter={next} direction="next" onOpen={openChapter} />
                </nav>
              </>
            )
          )}
        </div>

        {/* Index (xl+) */}
        {hasIndex && (
          <div className="sticky top-[100px] hidden max-h-[calc(100dvh-124px)] overflow-y-auto pb-4 xl:block">
            <SectionIndex sections={doc.sections} active={activeSection} onSelect={goToSection} />
          </div>
        )}
      </div>

      {sheet === 'contents' && active && (
        <BottomSheet
          title="Chapter contents"
          subtitle={`${active.moduleName} · ${doc.sections.length} ${doc.sections.length === 1 ? 'section' : 'sections'}`}
          onClose={() => setSheet(null)}
        >
          <ol className="flex flex-col gap-1">
            {doc.sections.map((section, i) => (
              <NumberedOption key={section.id} index={i + 1} label={section.title} current={section.id === activeSection} onSelect={() => goToSection(section.id)} />
            ))}
          </ol>
        </BottomSheet>
      )}
      {sheet === 'chapters' && (
        <BottomSheet
          title="Chapters"
          subtitle={`${active?.courseName ? `${active.courseName} · ` : ''}${total} chapters`}
          onClose={() => setSheet(null)}
        >
          <ol className="flex flex-col gap-1">
            {chapters.map((chapter, i) => (
              <NumberedOption
                key={chapter.moduleId}
                index={i + 1}
                label={chapter.moduleName}
                current={chapter.moduleId === active?.moduleId}
                onSelect={() => openChapter(chapter)}
              />
            ))}
          </ol>
        </BottomSheet>
      )}
    </div>
  );
}

function ChapterStep({
  chapter,
  direction,
  onOpen,
}: {
  chapter: ChapterNotes | undefined;
  direction: 'previous' | 'next';
  onOpen: (chapter: ChapterNotes) => void;
}) {
  const isNext = direction === 'next';
  return (
    <button
      type="button"
      disabled={!chapter}
      onClick={() => chapter && onOpen(chapter)}
      className={cx(
        'border-learn-line-strong bg-surface flex min-w-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40 lg:max-w-[48%] lg:gap-3 lg:rounded-2xl lg:px-5 lg:py-3',
        isNext && 'ml-auto flex-row-reverse text-right',
      )}
    >
      {isNext ? <ChevronRight aria-hidden className="size-4 shrink-0" /> : <ChevronLeft aria-hidden className="size-4 shrink-0" />}
      <span className="flex min-w-0 flex-col">
        <span>{isNext ? 'Next' : 'Previous'}</span>
        {chapter && <span className="text-neutral-550 hidden truncate text-[12px] font-medium lg:block">{chapter.moduleName}</span>}
      </span>
    </button>
  );
}
