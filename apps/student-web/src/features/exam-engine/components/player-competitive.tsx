'use client';

import { Dialog, DialogContent, DialogTitle, cx } from '@prepzy/design-system';
import { ArrowLeft, ChevronRight, Clock, House, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { statusOf } from '../attempt';
import { formatDuration } from '../hooks';
import type { ExamPlayerLayout } from './player-types';
import { QuestionGrid, StatusLegend, TEST_LEGEND } from './question-palette';
import { QuestionView } from './question-view';

const pill = 'h-10 rounded-full px-6 text-sm font-semibold transition-colors disabled:opacity-50';
const card = 'bg-surface rounded-2xl border border-neutral-100 shadow-sm';

/** Breadcrumb bar shared by the competitive player and result: Back · Dashboard > Section > Test. */
export function CompetitiveBreadcrumb({
  home,
  current,
  onBack,
  children,
}: {
  home: { label: string; href: string };
  current: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  const exam = useExam();
  return (
    <div className="flex items-stretch gap-2 lg:gap-2">
      <button
        type="button"
        onClick={onBack}
        className={cx(card, 'text-foreground flex shrink-0 items-center gap-2 px-4 text-sm font-medium lg:px-4')}
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span className="hidden lg:inline">Back</span>
        <span className="sr-only lg:hidden">Back</span>
      </button>
      <div className={cx(card, 'flex min-h-[68px] min-w-0 flex-1 items-center gap-4 px-4')}>
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-2 text-sm font-semibold">
            <li>
              <Link href={routes.dashboard(exam.slug)} className="text-brand flex items-center">
                <House aria-hidden className="size-5 lg:hidden" />
                <span className="hidden lg:inline">Dashboard</span>
                <span className="sr-only lg:hidden">Dashboard</span>
              </Link>
            </li>
            <ChevronRight aria-hidden className="text-foreground-subtle size-4 shrink-0" />
            <li className="truncate">
              <Link href={home.href} className="text-brand">
                {home.label}
              </Link>
            </li>
            <ChevronRight aria-hidden className="text-foreground-subtle size-4 shrink-0" />
            <li aria-current="page" className="text-foreground-subtle truncate">
              {current}
            </li>
          </ol>
        </nav>
        {children && <div className="hidden items-center gap-6 lg:flex">{children}</div>}
      </div>
    </div>
  );
}

function Timer({ secondsLeft, className }: { secondsLeft: number; className?: string }) {
  return (
    <span role="timer" className={cx('text-brand flex items-center gap-2 text-md font-bold tabular-nums', secondsLeft < 300 && 'text-danger', className)}>
      <Clock aria-hidden className="size-5" />
      <span className="sr-only">Time left </span>
      {formatDuration(secondsLeft, true)}
    </span>
  );
}

/** NEET-style player (previous app's NEETComponents/ExamComponents). */
export function CompetitivePlayer({ session, attempt, question, secondsLeft, counts, home, onSubmit, onExit, onNext }: ExamPlayerLayout) {
  const [statusOpen, setStatusOpen] = useState(false);
  const { index } = attempt;
  const marked = attempt.snapshot.marked.includes(question.id);
  // As in the previous app, the open question only turns "not answered" once the student leaves it.
  const statuses = session.questions.map((q, i) => {
    const status = statusOf(q.id, attempt.snapshot);
    return i === index && status === 'skipped' ? 'not-visited' : status;
  });
  const legendCounts = { marked: counts.marked, answered: counts.answered, 'not-visited': counts['not-visited'], skipped: counts.skipped };
  const select = (i: number) => {
    attempt.goTo(i);
    setStatusOpen(false);
  };
  const toggleMark = () => {
    attempt.toggleMark(question.id);
    if (!marked && index < attempt.total - 1) attempt.goTo(index + 1);
  };

  const actions = (
    <>
      <button type="button" onClick={attempt.skip} className="text-brand text-sm font-semibold max-lg:bg-surface max-lg:h-12 max-lg:flex-1 max-lg:rounded-full max-lg:shadow-sm">
        Skip Question
      </button>
      <div className="contents lg:flex lg:items-center lg:gap-4">
        <button
          type="button"
          aria-pressed={marked}
          onClick={toggleMark}
          className={cx(pill, 'border-neutral-150 bg-surface text-foreground border max-lg:h-12 max-lg:flex-1 lg:min-w-[206px]', marked && 'border-brand text-brand')}
        >
          {marked ? 'Marked for review' : 'Mark for review'}
        </button>
        <button type="button" onClick={onNext} className={cx(pill, 'bg-brand text-on-brand hover:bg-brand-hover max-lg:order-last max-lg:h-12 max-lg:w-full')}>
          Save &amp; Next
        </button>
      </div>
    </>
  );

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 p-4 pb-40 lg:p-10 lg:pt-12 lg:pb-10">
      <CompetitiveBreadcrumb home={home} current="Test" onBack={onExit}>
        {secondsLeft !== null && <Timer secondsLeft={secondsLeft} />}
        <button type="button" onClick={onSubmit} className={cx(pill, 'bg-brand text-on-brand hover:bg-brand-hover')}>
          Submit test
        </button>
      </CompetitiveBreadcrumb>

      <p className="text-foreground-muted text-xs" aria-live="polite">
        {counts.answeredTotal} of {attempt.total} answered
        {attempt.isSaving && ' · Saving…'}
        {attempt.saveFailed && !attempt.isSaving && ' · Not saved — will retry'}
      </p>

      {/* Phones: timer + submit, a scrolling palette and the status sheet */}
      <div className="flex items-center justify-between gap-4 lg:hidden">
        {secondsLeft !== null && (
          <Timer secondsLeft={secondsLeft} className={cx(card, 'text-foreground h-12 px-4')} />
        )}
        <button type="button" onClick={onSubmit} className={cx(pill, 'bg-brand text-on-brand h-12 px-10')}>
          Submit Test
        </button>
      </div>
      <div className="flex flex-col gap-2 lg:hidden">
        <QuestionGrid statuses={statuses} legend={TEST_LEGEND} current={index} onSelect={select} layout="row" />
        <button type="button" onClick={() => setStatusOpen(true)} className="text-brand flex items-center gap-2 self-end text-sm font-semibold">
          <ListChecks aria-hidden className="size-4" />
          View Status
        </button>
        <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
          <DialogContent className="bg-canvas">
            <DialogTitle>Question status</DialogTitle>
            <StatusLegend legend={TEST_LEGEND} counts={legendCounts} />
            <QuestionGrid statuses={statuses} legend={TEST_LEGEND} current={index} onSelect={select} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={cx(card, 'flex flex-col gap-8 p-6 lg:min-h-[600px]')}>
          <QuestionView
            key={question.id}
            look="competitive"
            question={question}
            number={index + 1}
            answer={attempt.snapshot.answers[question.id]}
            onAnswer={(value) => attempt.answer(question.id, value)}
          />
          <footer className="mt-auto hidden items-center justify-between gap-4 lg:flex">{actions}</footer>
        </section>
        <aside className="hidden flex-col gap-6 lg:flex">
          <StatusLegend legend={TEST_LEGEND} counts={legendCounts} />
          <QuestionGrid statuses={statuses} legend={TEST_LEGEND} current={index} onSelect={select} />
        </aside>
      </div>

      <footer className="bg-canvas shadow-bar-up fixed inset-x-0 bottom-0 z-30 flex flex-wrap gap-3 p-4 lg:hidden">{actions}</footer>
    </div>
  );
}
