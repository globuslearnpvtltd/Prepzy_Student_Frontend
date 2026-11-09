'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, Check, ChevronRight, ClipboardList, Download, FileClock, FileText, Film, PlayCircle, Video } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { activityHref, assessmentLabel, formatTitle, learnApi, type ChapterQuestion } from '../api';
import { learnKeys } from '../hooks';
import { ChapterSelector } from './chapter-selector';
import { SectionError } from './kit';

type Tab = 'learn' | 'practice';

/** "12 board questions, 2015 to 2023" for the chapter PYQ card. */
export function pyqSummary(questions: ChapterQuestion[]): string {
  if (questions.length === 0) return "Chapter PYQ's";
  const label = `${questions.length} board ${questions.length === 1 ? 'question' : 'questions'}`;
  const years = questions.map((q) => parseInt(q.year ?? '', 10)).filter((y) => !Number.isNaN(y));
  if (!years.length) return label;
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${label}, ${min}` : `${label}, ${min} to ${max}`;
}

function ItemCard({
  href,
  icon,
  tone,
  label,
  title,
  trailing,
}: {
  href: string;
  icon: ReactNode;
  tone: 'brand' | 'quiz';
  label: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <li className="w-full">
      <Link
        href={href}
        className="group border-learn-card bg-surface flex w-full items-center justify-between gap-3 rounded-xl border-[1.5px] p-3.5 shadow-card transition-shadow hover:shadow-lg md:p-5"
      >
        <span className="flex w-full items-center gap-3 md:gap-4">
          <span
            className={cx(
              'flex size-11 shrink-0 items-center justify-center rounded-[14px] md:size-[52px] md:rounded-lg',
              tone === 'quiz' ? 'bg-learn-quiz-soft text-learn-quiz' : 'bg-brand-75 text-brand',
            )}
          >
            {icon}
          </span>
          <span className="flex min-w-0 flex-col gap-1 md:gap-[3px]">
            <span
              className={cx(
                'w-fit text-[11px] leading-4 font-semibold tracking-wide uppercase',
                tone === 'quiz' ? 'text-learn-quiz' : 'text-brand',
              )}
            >
              {label}
            </span>
            <span className="line-clamp-2 text-[16px] leading-snug font-semibold text-neutral-900">{title}</span>
          </span>
        </span>
        {trailing}
      </Link>
    </li>
  );
}

const iconSize = 'size-[23px]';

/** A chapter: Learn (lectures, quizzes, chapter notes, summary video) and Practice (unit test, PYQs, NCERT). */
export function ModuleScreen({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const exam = useExam();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'practice' ? 'practice' : 'learn');
  const detail = useQuery({ queryKey: learnKeys.module(courseId, moduleId), queryFn: () => learnApi.module(courseId, moduleId) });
  const pyqs = useQuery({ queryKey: learnKeys.pyqs(moduleId), queryFn: () => learnApi.chapterPyqs(moduleId) });
  const ncert = useQuery({ queryKey: learnKeys.ncertCount(moduleId), queryFn: () => learnApi.ncertCount(moduleId) });

  const body = () => {
    if (detail.isError) return <SectionError title="Failed To Fetch Modules" error={detail.error} />;
    if (detail.isPending) {
      return (
        <div aria-busy="true" aria-label="Loading chapter" className="flex w-full flex-col gap-3 md:gap-4">
          <Skeleton className="h-11 w-full rounded-full md:w-[335px]" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl md:h-[92px]" />
          ))}
        </div>
      );
    }
    const { items, summaries } = detail.data;
    const isPractice = (item: (typeof items)[number]) => item.kind === 'assessment' && item.type === 'unit_test';
    const learnItems = items.filter((item) => !isPractice(item));
    const practiceItems = items.filter(isPractice);
    const practiceLoading = pyqs.isPending || ncert.isPending;
    const pyqCount = pyqs.data?.length ?? 0;
    const ncertCount = ncert.data ?? 0;
    const empty =
      tab === 'learn'
        ? learnItems.length === 0 && summaries.length === 0
        : !practiceLoading && practiceItems.length === 0 && pyqCount === 0 && ncertCount === 0;

    const itemCards = (tab === 'learn' ? learnItems : practiceItems).map((item) =>
      item.kind === 'assessment' ? (
        <ItemCard
          key={`a-${item.id}`}
          href={activityHref(exam.slug, courseId, { category: 'assessment', id: item.id, moduleId, type: item.type })}
          icon={<ClipboardList aria-hidden className={iconSize} />}
          tone="quiz"
          label={assessmentLabel(item.type)}
          title={formatTitle(item.title)}
          trailing={
            <span className="text-learn-quiz border-learn-quiz hidden shrink-0 items-center rounded-[14px] border-2 py-2 pr-1 pl-3 text-[16px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 md:flex">
              Attempt Exam <ChevronRight aria-hidden className="size-5" />
            </span>
          }
        />
      ) : (
        <ItemCard
          key={`l-${item.id}`}
          href={routes.lecture(exam.slug, courseId, moduleId, item.id)}
          icon={<Video aria-hidden className={iconSize} />}
          tone="brand"
          label="Video Lecture"
          title={formatTitle(item.title)}
          trailing={
            item.completed ? (
              <Check aria-label="Completed" className="text-brand size-5 shrink-0" />
            ) : (
              <span className="bg-brand text-on-brand hidden h-12 w-[140px] shrink-0 items-center justify-center rounded-[14px] text-[16px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 md:flex">
                Get Started <ChevronRight aria-hidden className="size-6" />
              </span>
            )
          }
        />
      ),
    );

    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 md:gap-4">
        <div role="tablist" aria-label="Chapter sections" className="bg-learn-track grid w-full grid-cols-2 self-start rounded-full p-1 md:w-[335px]">
          {(['learn', 'practice'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cx(
                'rounded-full py-2 text-[14px] leading-5 transition-colors',
                tab === key ? 'bg-surface text-brand font-semibold shadow-sm' : 'text-learn-muted hover:text-brand font-medium',
              )}
            >
              {key === 'learn' ? 'Learn' : 'Practice'}
            </button>
          ))}
        </div>

        {empty && (
          <p className="text-learn-muted w-full py-10 text-center text-[14px] font-medium">
            {tab === 'learn' ? 'No lessons available yet.' : 'No practice available yet.'}
          </p>
        )}

        <ul className="flex w-full flex-col gap-3 md:gap-4">
          {tab === 'practice' && practiceLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} aria-hidden className="h-[72px] w-full rounded-xl md:h-[92px]" />)
            : itemCards}
          {tab === 'practice' && !practiceLoading && pyqCount > 0 && (
            <ItemCard
              href={routes.chapterPyqs(exam.slug, courseId, moduleId)}
              icon={<FileClock aria-hidden className={iconSize} />}
              tone="quiz"
              label="Chapter PYQ's"
              title={pyqSummary(pyqs.data ?? [])}
            />
          )}
          {tab === 'practice' && !practiceLoading && ncertCount > 0 && (
            <ItemCard
              href={routes.ncertQuestions(exam.slug, courseId, moduleId)}
              icon={<BookOpenCheck aria-hidden className={iconSize} />}
              tone="quiz"
              label="NCERT Chapter Questions"
              title={`${ncertCount} ${ncertCount === 1 ? 'question' : 'questions'} with solutions`}
            />
          )}
          {tab === 'learn' &&
            summaries.map((summary) => {
              const notes = summary.type === 'notes';
              return (
                <ItemCard
                  key={`${summary.type}-${summary.id}`}
                  href={notes ? routes.notesView(exam.slug, courseId, moduleId) : routes.summaryVideo(exam.slug, summary.id)}
                  icon={notes ? <FileText aria-hidden className={iconSize} /> : <Film aria-hidden className={iconSize} />}
                  tone="brand"
                  label={notes ? 'Chapter Notes' : 'Summary Video'}
                  title={notes ? 'Chapter notes' : 'Summary'}
                  trailing={
                    notes ? (
                      <Download aria-hidden className="text-brand size-[22px] shrink-0" />
                    ) : (
                      <PlayCircle aria-hidden className="text-brand size-[22px] shrink-0" />
                    )
                  }
                />
              );
            })}
        </ul>
      </div>
    );
  };

  return (
    <div className="h-full px-1 pt-1 pb-6 md:px-[22px] md:pb-[33px]">
      <ChapterSelector courseId={courseId} moduleId={moduleId} />
      {body()}
    </div>
  );
}
