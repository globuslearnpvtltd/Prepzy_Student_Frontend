'use client';

import { Dialog, DialogContent, DialogTitle, cx } from '@prepzy/design-system';
import { ArrowLeft, Check, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { isAnswered } from '../attempt';
import { formatDuration } from '../hooks';
import type { ExamQuestion } from '../model';
import type { ExamPlayerLayout } from './player-types';
import { QuestionView } from './question-view';

const tile = 'border-info-50 bg-info-25 rounded-[14px] border-[1.5px]';
/** Graph-paper backdrop of the previous board player. */
const gridBackdrop =
  'bg-[linear-gradient(var(--color-info-50)_1px,transparent_1px),linear-gradient(90deg,var(--color-info-50)_1px,transparent_1px)] bg-[size:24px_24px]';

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'bg-surface flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
        on ? 'border-info-700 text-info-700' : 'border-neutral-300',
      )}
    >
      {on && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/** Status column: timer, skipped / saved counts and questions grouped by type (previous app's ExamStatusCard). */
function StatusPanel({ session, attempt, question, secondsLeft, counts, onSelect }: ExamPlayerLayout & { onSelect: (i: number) => void }) {
  const groups = new Map<string, { question: ExamQuestion; index: number }[]>();
  session.questions.forEach((question, index) => {
    const list = groups.get(question.typeLabel) ?? [];
    list.push({ question, index });
    groups.set(question.typeLabel, list);
  });
  // Always the current question's type: Skip / Save & Next / Previous move the highlight across types, and a
  // tab click jumps to that type's first question (so the two never disagree).
  const shown = question.typeLabel;

  return (
    <div className="flex flex-col">
      <h2 className="mb-[26px] text-[24px] leading-6 font-bold text-neutral-950">Status</h2>
      <div className={cx(tile, 'mb-[22px] flex justify-between px-6 py-[17px] text-[16px] leading-4')}>
        <span className="font-medium text-neutral-900">Timer</span>
        {secondsLeft !== null && (
          <span role="timer" className={cx('font-semibold tabular-nums', secondsLeft < 300 ? 'text-danger' : 'text-neutral-850')}>
            <span className="sr-only">Time left </span>
            {formatDuration(secondsLeft, true)}
          </span>
        )}
      </div>
      <dl className="mb-[34px] flex gap-[22px]">
        {[
          { label: 'Skipped', value: counts.skipped, on: false },
          { label: 'Saved', value: counts.answeredTotal, on: true },
        ].map((stat) => (
          <div key={stat.label} className={cx(tile, 'flex w-1/2 flex-col gap-2.5 p-[18px] text-[16px] leading-4')}>
            <dt className="font-medium text-neutral-900">{stat.label}</dt>
            <dd className="text-neutral-850 flex items-center gap-2.5 font-semibold">
              <Tick on={stat.on} />
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-4 text-[24px] leading-6 font-bold text-neutral-950">Questions</h2>
      <div className="mb-3 grid grid-cols-3 gap-2.5" role="tablist" aria-label="Question types">
        {[...groups.keys()].map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={shown === label}
            onClick={() => onSelect(groups.get(label)![0]!.index)}
            className={cx(
              'rounded-[36px] border-[1.5px] px-1 py-2.5 text-[12px] font-bold',
              shown === label ? 'bg-info-700 border-info-700 text-on-brand' : 'border-info-50 text-neutral-900',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <nav aria-label="Questions" className="flex max-h-[260px] flex-col gap-2.5 overflow-y-auto">
        {(groups.get(shown) ?? []).map(({ question, index }) => {
          const saved = isAnswered(attempt.snapshot.answers[question.id]);
          return (
            <button
              key={question.id}
              type="button"
              aria-current={index === attempt.index ? 'step' : undefined}
              aria-label={`Question ${index + 1}${saved ? ', saved' : ''}`}
              onClick={() => onSelect(index)}
              className={cx(
                'border-info-50 flex items-center gap-3 rounded-[14px] border-[1.5px] px-6 py-4 text-left text-[13px] font-medium text-neutral-900',
                index === attempt.index ? 'bg-info-25' : 'bg-surface',
              )}
            >
              <Tick on={saved} />
              {/* The paper-wide number, the same one the question card shows. */}
              Question {index + 1}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** CBSE-style player (previous app's components/elements/mock-exam). */
export function BoardPlayer(props: ExamPlayerLayout) {
  const { attempt, question, secondsLeft, onSubmit, onExit, onNext } = props;
  const [statusOpen, setStatusOpen] = useState(false);
  const { index } = attempt;
  const select = (i: number) => {
    attempt.goTo(i);
    setStatusOpen(false);
  };

  return (
    <div className="flex min-h-[calc(100dvh-76px)] flex-col">
      <div className="bg-info-25 border-info-50 flex items-center gap-4 border-b px-3 py-6 md:px-5">
        <button type="button" onClick={onExit} aria-label="Back" className="text-foreground">
          <ArrowLeft aria-hidden className="size-6" />
        </button>
        <h1 className="text-foreground flex-1 text-lg font-medium">Assessment</h1>
        <p className="text-foreground-muted hidden text-xs sm:block" aria-live="polite">
          {attempt.isSaving ? 'Saving…' : attempt.saveFailed ? 'Not saved — will retry' : ''}
        </p>
        <button type="button" onClick={onSubmit} className="bg-info-700 text-on-brand h-14 rounded-[10px] px-4 text-sm font-medium hover:opacity-90">
          Finish Quiz
        </button>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className={cx('flex flex-1 flex-col gap-6 px-3 py-6 md:px-6', gridBackdrop)}>
          <div className="flex items-center justify-between gap-3 lg:hidden">
            {secondsLeft !== null && (
              <span role="timer" className={cx(tile, 'px-4 py-2 text-sm font-semibold tabular-nums')}>
                <span className="sr-only">Time left </span>
                {formatDuration(secondsLeft, true)}
              </span>
            )}
            <button type="button" onClick={() => setStatusOpen(true)} className="text-info-700 text-sm font-semibold">
              View Status
            </button>
          </div>
          <section className="bg-surface border-info-50 overflow-hidden rounded-[14px] border shadow-card">
            <QuestionView
              key={question.id}
              look="board"
              question={question}
              number={index + 1}
              answer={attempt.snapshot.answers[question.id]}
              onAnswer={(value) => attempt.answer(question.id, value)}
            />
          </section>
          <footer className="flex items-center gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => attempt.goTo(index - 1)}
              className="text-on-brand flex h-[50px] items-center gap-1 rounded-[10px] bg-neutral-350 px-6 text-[16px] disabled:opacity-60"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={attempt.skip}
              className="border-info-700 text-info-700 bg-surface ml-auto h-[50px] rounded-[10px] border px-4 text-[16px]"
            >
              Skip
            </button>
            <button type="button" onClick={onNext} className="bg-info-700 text-on-brand h-[50px] rounded-[10px] px-[18px] text-[16px] hover:opacity-90">
              Save &amp; Next
            </button>
          </footer>
        </div>
        <aside className="bg-surface border-info-50 hidden w-[360px] shrink-0 border-l px-[45px] py-[40px] lg:block">
          <StatusPanel {...props} onSelect={select} />
        </aside>
      </div>
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogTitle className="sr-only">Status</DialogTitle>
          <StatusPanel {...props} onSelect={select} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
