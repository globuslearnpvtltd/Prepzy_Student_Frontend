'use client';

import { cx } from '@prepzy/design-system';
import { BookOpen, ChevronRight, FileText, Play, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ExamCategory, ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import type { LectureSearchResult } from './shell-api';

/** PostHog's `result_type` of a clicked search result (the previous app's values). */
export type SearchResultType = 'video_lesson' | 'study_notes' | 'practice_question' | 'assessment';

export interface SearchResultLink {
  type: SearchResultType;
  /** 1-based position in the panel (sent to PostHog) */
  position: number;
  href: string;
}

/**
 * How the results panel looks per exam category (as before):
 * - lecture: "Recommended video" (the lecture) and "Practice & assess" (its quizzes / tests)
 * - chapter: the chapter's name, then its Video Lesson, Study Notes and Practice Questions steps
 */
export const RESULT_LAYOUT: Record<ExamCategory, 'lecture' | 'chapter'> = {
  board: 'lecture',
  competitive: 'chapter',
  reference: 'lecture',
};

/** Every link the panel shows for a result, in order, with its page in the new app. */
export function resultLinks(exam: ExamConfig, result: LectureSearchResult): SearchResultLink[] {
  const { courseId, moduleId, lectureId } = result;
  const links: SearchResultLink[] =
    RESULT_LAYOUT[exam.category] === 'chapter'
      ? [
          { type: 'video_lesson', position: 1, href: routes.learnModule(exam.slug, courseId, moduleId, 'video-lectures') },
          { type: 'study_notes', position: 2, href: routes.learnModule(exam.slug, courseId, moduleId, 'study-notes') },
          { type: 'practice_question', position: 3, href: routes.learnModule(exam.slug, courseId, moduleId, 'practice-questions') },
        ]
      : [{ type: 'video_lesson', position: 1, href: routes.lecture(exam.slug, courseId, moduleId, lectureId) }];
  // Lecture quizzes open in the quiz player, which only exams with quizzes have.
  if (exam.testTypes.includes('quiz')) {
    const before = links.length;
    result.assessments.forEach((assessment, index) =>
      links.push({ type: 'assessment', position: before + 1 + index, href: routes.testPlayer(exam.slug, 'quiz', assessment.assessmentId) }),
    );
  }
  return links;
}

const score = (result: LectureSearchResult) => (result.scorePercent === null ? null : `Match Score ${result.scorePercent}%`);

function Row({
  link,
  icon,
  title,
  subtitle,
  badge,
  tone = 'brand',
  capitalize = false,
  onOpen,
}: {
  link: SearchResultLink;
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  badge?: string;
  tone?: 'brand' | 'warning';
  /** Shows a lower-cased title in title case (the previous app's look for lecture and assessment names). */
  capitalize?: boolean;
  onOpen: (link: SearchResultLink) => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={() => onOpen(link)}
      className="group hover:bg-brand-25 focus-visible:bg-brand-25 flex items-center justify-between gap-3 p-3 outline-none"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cx(
            'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
            tone === 'brand'
              ? 'bg-brand-25 text-brand border-line group-hover:bg-brand group-hover:text-on-brand'
              : 'bg-warning-50 text-warning-600 border-warning-100 group-hover:bg-warning-500 group-hover:text-on-brand',
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span
            className={cx(
              'text-foreground line-clamp-2 text-[13px] leading-tight font-bold',
              capitalize && 'capitalize',
              tone === 'brand' ? 'group-hover:text-brand' : 'group-hover:text-warning-600',
            )}
          >
            {title}
          </span>
          {subtitle && <span className="text-foreground-subtle text-[12px] font-medium">{subtitle}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge && (
          <span className="bg-warning-50 text-warning-700 border-warning-100 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap uppercase">
            {badge}
          </span>
        )}
        <ChevronRight aria-hidden className="text-foreground-subtle group-hover:text-brand size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </Link>
  );
}

const Heading = ({ children }: { children: ReactNode }) => (
  <div className="bg-canvas border-line border-b px-3 py-2">
    <span className="text-foreground-muted text-[11px] font-semibold tracking-wide">{children}</span>
  </div>
);

/**
 * The search button's result: the lecture the semantic search found (video, notes, practice and its assessments,
 * laid out per category), or a loading, empty or error state.
 */
export function SearchResults({
  exam,
  id,
  status,
  result,
  error,
  onRetry,
  onDismiss,
  onOpen,
}: {
  exam: ExamConfig;
  id: string;
  status: 'pending' | 'error' | 'success';
  result: LectureSearchResult | null;
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
  onOpen: (link: SearchResultLink) => void;
}) {
  const frame = 'border-line bg-surface absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-lg';

  if (status === 'pending') {
    return (
      <div id={id} role="status" className={cx(frame, 'text-foreground-muted p-3 text-center text-xs')}>
        <span className="flex animate-pulse flex-col items-center gap-2">
          <span aria-hidden className="bg-line h-1.5 w-20 rounded" />
          Finding relevant search results for you...
        </span>
      </div>
    );
  }

  if (status === 'error' || !result) {
    return (
      <div id={id} role={status === 'error' ? 'alert' : 'status'} className={cx(frame, 'flex items-start justify-between gap-3 p-3')}>
        <span className="flex flex-col gap-1">
          <span className="text-foreground text-[13px] font-semibold">
            {status === 'error' ? "Search couldn't finish" : 'No matching lesson found'}
          </span>
          <span className="text-foreground-subtle text-[12px]">
            {status === 'error' ? (error ?? 'Please try again.') : 'Try other words, or pick one of the suggestions.'}
          </span>
          {status === 'error' && (
            <button type="button" onClick={onRetry} className="text-brand mt-1 self-start text-[12px] font-semibold hover:underline">
              Try again
            </button>
          )}
        </span>
        <DismissButton onDismiss={onDismiss} />
      </div>
    );
  }

  const links = resultLinks(exam, result);
  const [video, ...rest] = links;
  const chapterLayout = RESULT_LAYOUT[exam.category] === 'chapter';
  const steps = chapterLayout ? rest.slice(0, 2) : [];
  const assessmentLinks = rest.slice(steps.length);
  const lectureTitle = (result.lectureName ?? result.moduleName).toLowerCase();

  return (
    <section id={id} aria-label="Search results" className={frame}>
      <div className="absolute top-2 right-2 z-10">
        <DismissButton onDismiss={onDismiss} />
      </div>
      {chapterLayout ? (
        <div className="bg-canvas border-line flex flex-col border-b px-3 py-2 pr-10">
          <span className="text-foreground-subtle text-[10px] font-semibold tracking-wide uppercase">Chapter</span>
          <span className="text-brand line-clamp-1 text-[14px] leading-tight font-bold capitalize">{result.moduleName.toLowerCase()}</span>
        </div>
      ) : (
        <Heading>Recommended video</Heading>
      )}

      {chapterLayout ? (
        <div className="divide-line flex flex-col divide-y">
          <Row link={video!} onOpen={onOpen} icon={<Play className="ml-0.5 size-4" />} title="Video Lesson" subtitle={score(result)} />
          <Row link={steps[0]!} onOpen={onOpen} icon={<BookOpen className="size-[18px]" />} title="Study Notes" subtitle="Chapter notes & summary" />
          <Row link={steps[1]!} onOpen={onOpen} icon={<FileText className="size-[18px]" />} title="Practice Questions" subtitle="Chapter assessment" />
        </div>
      ) : (
        <Row
          link={video!}
          onOpen={onOpen}
          icon={<Play className="ml-0.5 size-4" />}
          capitalize
          title={lectureTitle}
          subtitle={['Video lesson', score(result)].filter(Boolean).join(' • ')}
        />
      )}

      {assessmentLinks.length > 0 && (
        <div className="border-line border-t">
          <Heading>Practice & assess</Heading>
          <div className="divide-line flex flex-col divide-y">
            {assessmentLinks.map((link, index) => {
              const assessment = result.assessments[index]!;
              return (
                <Row
                  key={`${assessment.assessmentId}-${index}`}
                  link={link}
                  onOpen={onOpen}
                  tone="warning"
                  icon={<FileText className="size-[18px]" />}
                  capitalize
                  title={assessment.title.toLowerCase()}
                  badge={assessment.type}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss search results"
      className="text-foreground-subtle hover:text-foreground hover:bg-canvas shrink-0 rounded-full p-1 transition-colors"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
