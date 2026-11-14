'use client';

import { Button, cx } from '@prepzy/design-system';
import { Check, ChevronLeft, ChevronRight, MessageSquare, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import type { ExamCategory, TestTypeKey } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { PageSpinner, StatusScreen } from '@/shared/layout/status-screens';
import { userMessage } from '@/shared/lib/errors';
import { useExamResult } from '../hooks';
import type { ExamResult, Outcome, ResultQuestion } from '../model';
import { testHome } from '../test-links';
import { CompetitiveBreadcrumb, competitivePage } from './player-competitive';
import { QuestionGrid, REVIEW_LEGEND, StatusLegend } from './question-palette';
import { ReportProblem } from './report-problem';
import { RichText } from './rich-text';

// Loaded on demand (and keeps exam-engine → assistant out of the static import graph).
const ReviewChat = dynamic(() => import('@/features/assistant/ui').then((m) => m.ReviewChat), { ssr: false });

/** Attempt + paper ids for the post-submission chat ("Discuss with Vedica"). */
const ReviewIds = createContext<{ attemptId: string; assessmentId: string | null } | null>(null);

export function ResultView({ testType, attemptId }: { testType: TestTypeKey; attemptId: string }) {
  const exam = useExam();
  const result = useExamResult(testType, attemptId);
  const home = testHome(exam, testType);

  if (result.isPending) return <PageSpinner label="Loading your result" />;
  if (result.isError) {
    return (
      <StatusScreen
        title="We couldn't load this result"
        description={userMessage(result.error)}
        action={
          <Button asChild intent="outline">
            <Link href={home.href}>Back to {home.label}</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ReviewIds.Provider value={{ attemptId, assessmentId: result.data.assessmentId ?? null }}>
      <ResultContent result={result.data} home={home} category={exam.category} />
    </ReviewIds.Provider>
  );
}

export function ResultContent({
  result,
  home,
  category,
}: {
  result: ExamResult;
  home: { label: string; href: string };
  category: ExamCategory;
}) {
  return category === 'board' ? <BoardResult result={result} home={home} /> : <CompetitiveResult result={result} home={home} />;
}

/* ------------------------------ shared pieces ------------------------------ */

/**
 * "Discuss with Vedica" prompt under each answer: opens a chat about the question (streamed replies).
 * Without the paper id (some result APIs don't send it) it falls back to the doubt solver.
 */
function DiscussCard({ question }: { question: ResultQuestion }) {
  const exam = useExam();
  const ids = useContext(ReviewIds);
  const [open, setOpen] = useState(false);
  const outcome = question.outcome;
  const copy: Record<Outcome, { title: string; tone: string; text: string }> = {
    correct: {
      title: 'Nailed it!',
      tone: 'text-success-700',
      text: 'Want to explore alternative ways to think about this question or test your depth of understanding?',
    },
    partial: {
      title: "You're on the right track!",
      tone: 'text-accent-600',
      text: "Let's brainstorm together on how to improve this answer to score full marks.",
    },
    incorrect: {
      title: 'Confused by this one?',
      tone: 'text-danger-450',
      text: "Let's discuss this question together and figure out where the confusion lies.",
    },
    unattempted: {
      title: 'Confused by this one?',
      tone: 'text-danger-450',
      text: "Let's discuss this question together and figure out where the confusion lies.",
    },
  };
  const c = copy[outcome];
  return (
    <div className="border-info-50 bg-info-25 flex flex-col gap-4 rounded-[14px] border p-6 sm:flex-row sm:items-center">
      <Image src="/illustrations/tests/vedica.jpg" alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
      <div className="flex-1">
        <p className={cx('text-md font-semibold', c.tone)}>{c.title}</p>
        <p className="text-foreground-muted text-xs">{c.text}</p>
      </div>
      {ids?.assessmentId ? (
        <button type="button" onClick={() => setOpen(true)} className={discussButton}>
          <MessageSquare aria-hidden className="size-5" />
          Discuss with Vedica
        </button>
      ) : (
        <Link href={routes.doubtSolver(exam.slug)} className={discussButton}>
          <MessageSquare aria-hidden className="size-5" />
          Discuss with Vedica
        </Link>
      )}
      {open && ids?.assessmentId && (
        <ReviewChat
          open
          onClose={() => setOpen(false)}
          context={{
            assessmentId: ids.assessmentId,
            questionId: question.id,
            attemptId: ids.attemptId,
            questionText: question.html,
            questionDiagram: question.image,
            sampleAnswer: question.sampleAnswerHtml,
            studentAnswer: question.answerHtml,
            marksAwarded: question.obtained ?? 0,
            totalMarks: question.marks ?? 0,
            feedback: question.feedbackHtml,
            options: question.options.map((o) => ({ id: o.id, text: o.html })),
            correctOptionId: question.options.find((o) => o.isCorrect)?.id ?? null,
            selectedOptionId: question.options.find((o) => o.isSelected)?.id ?? null,
          }}
        />
      )}
    </div>
  );
}

const discussButton = 'border-neutral-150 bg-surface text-brand-400 flex items-center gap-2 rounded-full border px-6 py-3 text-[16px] font-semibold';

/* --------------------------------- board ---------------------------------- */

const OUTCOME_LABEL: Record<Outcome, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  partial: 'Partially Correct',
  unattempted: 'Not Attempted',
};

function BoardResult({ result, home }: { result: ExamResult; home: { label: string; href: string } }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <Link
        href={home.href}
        aria-label={`Back to ${home.label}`}
        className="bg-surface shadow-card flex size-10 items-center justify-center rounded-full"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <header className="bg-info-600 text-on-brand flex items-center justify-between rounded-[14px] px-5 py-4">
        <h1 className="text-lg font-medium">Your Score</h1>
        <p className="text-lg font-semibold" aria-label={`Score ${result.obtained} out of ${result.totalMarks}`}>
          {result.obtained}/{result.totalMarks}
        </p>
      </header>
      <ol className="bg-surface border-border flex flex-col rounded-[20px] border px-5 py-10 sm:px-10">
        {result.questions.map((question, i) => (
          <li key={question.id} className="border-neutral-250 flex flex-col gap-5 border-b border-dashed py-10 last:border-b-0">
            <BoardResultQuestion question={question} number={i + 1} />
            <DiscussCard question={question} />
            <ReportProblem questionId={question.id} questionHtml={question.html} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function BoardResultQuestion({ question, number }: { question: ResultQuestion; number: number }) {
  const [ideal, setIdeal] = useState(false);
  return (
    <article className="flex flex-col gap-5" aria-label={`Question ${number}`}>
      <div className="flex gap-2 text-[16px]">
        <span className="font-semibold">{number}.</span>
        <RichText html={question.html} className="text-brand-950 min-w-0 flex-1" />
      </div>
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image} alt="" className="max-h-72 w-fit rounded-md" loading="lazy" />
      )}
      {question.options.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Options">
          {question.options.map((option) => (
            <li
              key={option.id}
              className={cx(
                'border-border flex w-fit items-center gap-2.5 rounded-[10px] border px-[18px] py-3 text-sm',
                option.isCorrect && 'border-success-450',
                option.isSelected && !option.isCorrect && 'border-danger-450',
              )}
            >
              <span
                aria-hidden
                className={cx('size-5 rounded-full border border-neutral-300', option.isSelected && 'border-info-700 border-[6px]')}
              />
              <RichText html={option.html} />
              {(option.isSelected || option.isCorrect) && (
                <span className="text-foreground-muted text-xs font-semibold">
                  {option.isSelected && option.isCorrect
                    ? '· Your answer · correct'
                    : option.isCorrect
                      ? '· Correct answer'
                      : '· Your answer'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {question.answerHtml && (
        <section>
          <h3 className="mb-3 text-[16px] font-semibold">Your Answer:</h3>
          <RichText html={question.answerHtml} className="text-brand-950" />
        </section>
      )}
      {question.parts.map((part, i) => (
        <section key={part.id} className="border-info-50 rounded-[14px] border p-4">
          <p className="mb-2 text-sm font-semibold">
            Part {String.fromCharCode(97 + i)} · {part.obtained ?? 0}/{part.marks ?? 0}
          </p>
          <BoardResultQuestion question={part} number={i + 1} />
        </section>
      ))}
      <section className="border-info-50 bg-info-25 flex flex-col gap-3 rounded-[14px] border p-6">
        <p className="flex items-center gap-2 text-lg font-medium">
          {question.outcome === 'incorrect' || question.outcome === 'unattempted' ? (
            <X aria-hidden className="text-danger size-5" />
          ) : (
            <Check aria-hidden className="size-5" />
          )}
          {OUTCOME_LABEL[question.outcome]}
        </p>
        {question.feedbackHtml && (
          <div>
            <p className="text-sm font-semibold">Reason:</p>
            <RichText html={question.feedbackHtml} className="text-brand-950" />
          </div>
        )}
        {question.marks !== null && (
          <p className="text-lg">
            Marks Obtained: <span className="text-info-600 font-semibold">{question.obtained ?? 0}</span>/
            <span className="font-semibold">{question.marks}</span>
          </p>
        )}
        {(question.sampleAnswerHtml || question.explanationImage) && (
          <>
            <button
              type="button"
              aria-expanded={ideal}
              onClick={() => setIdeal((v) => !v)}
              className="bg-info-600 text-on-brand flex w-fit items-center gap-1 rounded-[10px] px-4 py-3 text-sm"
            >
              {ideal ? 'Hide Ideal Answer' : 'View Ideal Answer'}
              <ChevronRight aria-hidden className="size-4" />
            </button>
            {ideal && (
              <div className="bg-surface rounded-[10px] p-4">
                <RichText html={question.sampleAnswerHtml} className="text-sm" />
                {question.explanationImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={question.explanationImage} alt="Explanation" className="mt-3 max-h-72 w-auto rounded-md" loading="lazy" />
                )}
              </div>
            )}
          </>
        )}
      </section>
    </article>
  );
}

/* ------------------------------ competitive ------------------------------- */

function CompetitiveResult({ result, home }: { result: ExamResult; home: { label: string; href: string } }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const question = result.questions[index];
  const statuses = result.questions.map((q) => q.outcome);
  const card = 'bg-surface rounded-2xl border border-neutral-100 shadow-sm';

  return (
    <div className={cx(competitivePage, 'pb-10')}>
      <CompetitiveBreadcrumb home={home} current="Result" onBack={() => router.push(home.href)} />
      <section className={cx(card, 'flex flex-wrap items-center justify-between gap-4 px-6 py-4')}>
        <div>
          <h1 className="text-lg font-semibold">{result.title}</h1>
          {result.attemptedAt && (
            <p className="text-foreground-muted text-xs">
              {new Date(result.attemptedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <p className="text-brand text-2xl font-bold" aria-label={`Score ${result.obtained} out of ${result.totalMarks}`}>
          {result.obtained}
          <span className="text-foreground-subtle text-md font-medium"> / {result.totalMarks}</span>
        </p>
      </section>

      {question ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className={cx(card, 'flex flex-col gap-6 p-6')}>
            <h2 className="bg-brand-75 text-brand w-fit rounded-md px-4 py-1.5 text-[11px] font-semibold">Question {index + 1}</h2>
            <RichText html={question.html} className="text-lg font-semibold text-neutral-950" />
            {question.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={question.image} alt="" className="max-h-72 w-fit rounded-md" loading="lazy" />
            )}
            <p className="text-sm font-medium text-neutral-800">Choose the correct answer from the options given below:</p>
            <ul className="flex flex-col gap-4" aria-label="Options">
              {question.options.map((option, i) => {
                const state = option.isCorrect ? 'correct' : option.isSelected ? 'incorrect' : 'none';
                return (
                  <li
                    key={option.id}
                    data-result={state}
                    className={cx(
                      'flex min-h-[60px] items-center gap-4 rounded-lg border-2 px-6 text-sm',
                      state === 'correct' && 'border-success-450 bg-success-50 text-success-450 font-semibold',
                      state === 'incorrect' && 'border-danger-450 bg-danger-25 text-danger-450 font-semibold',
                      state === 'none' && 'border-neutral-150',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cx(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        state === 'correct' ? 'bg-success-450 text-on-brand' : state === 'incorrect' ? 'bg-danger-450 text-on-brand' : 'bg-canvas text-foreground-muted',
                      )}
                    >
                      {state === 'correct' ? <Check className="size-4" /> : state === 'incorrect' ? <X className="size-4" /> : String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">
                      <RichText html={option.html} />
                      <span className="sr-only">
                        {option.isCorrect && option.isSelected ? ' · Your answer · correct' : option.isCorrect ? ' · Correct answer' : option.isSelected ? ' · Your answer' : ''}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {(question.sampleAnswerHtml || question.explanationImage) && (
              <section className="bg-canvas rounded-2xl p-6">
                <h3 className="mb-4 text-xl font-semibold text-neutral-700">Detailed Solution &amp; Explanation</h3>
                <RichText html={question.sampleAnswerHtml} className="text-md text-neutral-700" />
                {question.explanationImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={question.explanationImage} alt="Explanation" className="mt-3 max-h-72 w-auto rounded-md" loading="lazy" />
                )}
              </section>
            )}
            <DiscussCard question={question} />
            <footer className="flex justify-between gap-3">
              <Button intent="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                <ChevronLeft aria-hidden className="size-4" />
                Previous
              </Button>
              <Button disabled={index === result.questions.length - 1} onClick={() => setIndex(index + 1)}>
                Next
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </footer>
          </section>
          <aside className="flex flex-col gap-6">
            <StatusLegend legend={REVIEW_LEGEND.filter((l) => l.status !== 'partial')} counts={{
              correct: result.counts.correct,
              incorrect: result.counts.incorrect,
              unattempted: result.counts.unattempted,
            }} />
            <QuestionGrid statuses={statuses} legend={REVIEW_LEGEND} current={index} onSelect={setIndex} />
          </aside>
        </div>
      ) : (
        <p className="text-foreground-muted text-sm">No questions to review.</p>
      )}
    </div>
  );
}
