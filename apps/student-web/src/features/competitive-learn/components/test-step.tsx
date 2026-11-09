'use client';

import { cx } from '@prepzy/design-system';
import { FileText, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { bestAttempt, type PastAttempt } from '../api';
import { useChapter, useChapterPyqAttempts, usePracticeAssessment, usePracticeAttempts } from '../hooks';
import type { ChapterProps } from './chapter-screen';
import { Breadcrumb, StepNav } from './kit';

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Attempts so far, the best score, and a "Review Solutions" link per attempt. */
export function AttemptHistory({ attempts, testType }: { attempts: PastAttempt[]; testType: TestTypeKey }) {
  const exam = useExam();
  const best = bestAttempt(attempts);
  if (!best) return null;
  return (
    <section aria-labelledby="attempt-history" className="bg-surface flex w-full flex-col gap-3 p-3 lg:h-[calc(100dvh-200px)] lg:w-[370px] lg:shrink-0">
      <h2 id="attempt-history" className="text-xl font-bold text-neutral-950">
        Attempt History
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: String(attempts.length), label: 'Attempts' },
          { value: `${best.marks}/${best.totalMarks}`, label: 'Best Score' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-lg p-4 text-center shadow-sm">
            <p className="text-brand text-2xl font-bold">{stat.value}</p>
            <p className="mt-1 text-xs font-medium text-neutral-350">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <span className="text-brand text-xs font-semibold tracking-wide uppercase">Your Attempts</span>
        <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto [scrollbar-width:none] lg:max-h-none lg:min-h-0 lg:flex-1">
          {attempts.map((attempt) => (
            <li
              key={attempt.attemptId}
              className={cx('bg-surface rounded-lg p-4 shadow-sm', attempt.latest ? 'border-brand border-2' : 'border border-neutral-100')}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-neutral-350 uppercase">Attempt {attempt.number}</span>
                {attempt.latest && <span className="bg-brand-75 text-brand rounded-full px-2.5 py-0.5 text-[10px] font-bold">Latest</span>}
              </div>
              <div className="mt-1 flex items-end justify-between">
                <span className="text-2xl font-bold text-neutral-950">
                  {attempt.marks}/{attempt.totalMarks}
                </span>
                <span className="text-xs text-neutral-350">Score</span>
              </div>
              <p className="mt-1 text-xs text-neutral-350">{formatDate(attempt.date)}</p>
              <Link
                href={routes.testResult(exam.slug, testType, attempt.attemptId)}
                className="border-brand text-brand hover:bg-brand-50 mt-3 block w-full rounded-md border py-2 text-center text-sm font-semibold transition-colors"
              >
                Review Solutions
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StartCard({
  title,
  description,
  questions,
  minutes,
  extra,
  start,
  footnote,
}: {
  title: string;
  description: ReactNode;
  questions: string;
  minutes: string;
  extra?: ReactNode;
  start: { label: string; href: string | null };
  footnote: string;
}) {
  const startClass = 'bg-brand text-on-brand hover:bg-brand-deep w-full rounded-lg py-3.5 text-center text-md font-semibold transition-colors';
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="bg-surface flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] p-2 text-center shadow-sm">
        <span className="bg-brand-75 flex size-16 items-center justify-center rounded-lg">
          <FileText aria-hidden className="text-brand size-7" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-neutral-950">{title}</h1>
          <p className="text-sm leading-relaxed text-neutral-500">{description}</p>
        </div>
        <dl className="grid w-full grid-cols-2 gap-1">
          {[
            { label: 'Questions', value: questions },
            { label: 'Time Limit', value: minutes },
          ].map((item) => (
            <div key={item.label} className="bg-brand-50 rounded-lg px-4 py-3">
              <dt className="text-[11px] font-semibold tracking-wide text-neutral-350 uppercase">{item.label}</dt>
              <dd className="text-brand text-lg font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
        {extra}
        {start.href ? (
          <Link href={start.href} className={startClass}>
            {start.label}
          </Link>
        ) : (
          <span aria-disabled="true" className={cx(startClass, 'cursor-not-allowed opacity-50')}>
            {start.label}
          </span>
        )}
        <p className="text-xs text-neutral-350">{footnote}</p>
      </div>
    </div>
  );
}

function StepFrame({ courseId, moduleId, step, crumb, children }: ChapterProps & { crumb: string; children: ReactNode }) {
  const exam = useExam();
  const chapter = useChapter(moduleId).data;
  const courseHref = routes.learnCourse(exam.slug, courseId);
  return (
    <div className="mx-auto flex w-full max-w-full min-w-0 flex-col gap-3 px-4 max-lg:pb-24 sm:gap-4">
      <Breadcrumb
        crumbs={[
          { label: chapter?.subject || 'Subject', href: courseHref },
          { label: chapter?.title || 'Chapter', href: routes.learnModule(exam.slug, courseId, moduleId, 'video-lectures') },
          { label: crumb },
        ]}
        backHref={courseHref}
        className="lg:flex-1"
        right={
          <div className="hidden lg:flex">
            <StepNav courseId={courseId} moduleId={moduleId} step={step} />
          </div>
        }
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">{children}</div>
    </div>
  );
}

/** Step 3: the chapter's practice assessment (20 MCQs, fresh questions each attempt). */
export function PracticeStep(props: ChapterProps) {
  const exam = useExam();
  const chapter = useChapter(props.moduleId).data;
  const assessment = usePracticeAssessment(props.moduleId);
  const attempts = usePracticeAttempts(assessment.data);
  const assessmentId = assessment.data ?? null;
  return (
    <StepFrame {...props} crumb="Assessment Test">
      <StartCard
        title="Chapter Assessment"
        description={
          <>
            Test your understanding of <span className="font-semibold text-neutral-700">{chapter?.title ?? 'this chapter'}</span>. This
            assessment consists of 20 multiple choice questions.
          </>
        }
        questions="20 MCQs"
        minutes="40 Mins"
        extra={
          <p className="text-brand flex items-center gap-2 text-sm font-semibold">
            <RotateCcw aria-hidden className="size-4" />
            Fresh Questions in each attempt
          </p>
        }
        start={{
          label: assessment.isPending ? 'Loading...' : 'Start Assessment',
          href: assessmentId ? routes.testPlayer(exam.slug, 'practice', assessmentId) : null,
        }}
        footnote={!assessment.isPending && !assessmentId ? 'No assessment available for this chapter yet' : 'Retake anytime for a different set.'}
      />
      <AttemptHistory attempts={attempts.data ?? []} testType="practice" />
    </StepFrame>
  );
}

/** Step 4: up to 10 previous-year questions from this chapter, 2 minutes each. */
export function ChapterPyqStep(props: ChapterProps) {
  const exam = useExam();
  const chapter = useChapter(props.moduleId).data;
  const attempts = useChapterPyqAttempts(props.moduleId);
  const count = chapter ? Math.min(10, chapter.pyqQuestionCount) : 10;
  return (
    <StepFrame {...props} crumb="Chapter PYQ">
      <StartCard
        title="Chapter Previous Year Questions"
        description={
          <>
            Practice previous year questions from{' '}
            <span className="font-semibold text-neutral-700">{chapter?.title ?? 'this chapter'}</span>. This test consists of {count}{' '}
            multiple choice questions.
          </>
        }
        questions={`${count} MCQs`}
        minutes={`${count * 2} Mins`}
        start={{ label: 'Start Test', href: routes.testPlayer(exam.slug, 'chapter-pyq', props.moduleId) }}
        footnote="You can retake this test anytime"
      />
      <AttemptHistory attempts={attempts.data ?? []} testType="chapter-pyq" />
    </StepFrame>
  );
}
