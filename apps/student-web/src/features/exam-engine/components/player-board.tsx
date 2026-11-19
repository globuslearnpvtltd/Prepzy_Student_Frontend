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

/** Short names on the status card's type chips (previous app's sectionLabels); the question card keeps the long ones. */
const CHIP_LABELS: Record<string, string> = {
  'Multiple choice': 'MCQ',
  'Grammar · multiple choice': 'Grammar MCQ',
  'Very short answer': 'Very Short Answer',
  'Short answer': 'Short Answer',
  'Long answer': 'Long Answer',
  'Long answer (type I)': 'Long Answer I',
  'Long answer (type II)': 'Long Answer II',
  'Letter writing': 'Letter',
  'Paragraph writing': 'Paragraph',
  'Case based': 'Case Based',
  'Unseen passage': 'Unseen Passage',
};
export const chipLabel = (typeLabel: string) => CHIP_LABELS[typeLabel] ?? typeLabel;

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
function StatusPanel({
  session,
  attempt,
  question,
  secondsLeft,
  counts,
  onSelect,
}: ExamPlayerLayout & { onSelect: (i: number) => void }) {
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
      <h2 className="mt-0 mb-[26px] text-[24px] leading-6 font-bold text-neutral-950">Status</h2>
      <div className={cx(tile, 'mb-[22px] flex justify-between px-6 py-[17px] text-[16px] leading-4')}>
        <span className="font-medium text-neutral-900">Timer</span>
        {secondsLeft !== null && (
          <span
            role="timer"
            className={cx('font-semibold tabular-nums', secondsLeft < 300 ? 'text-danger' : 'text-neutral-850')}
          >
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
      <h2 className="mt-0 mb-4 text-[24px] leading-6 font-bold text-neutral-950">Questions</h2>
      {/* The old three equal columns: more types wrap onto the next row; each chip's name stays on one line. */}
      <div className="mb-3 grid grid-cols-3 gap-2.5" role="tablist" aria-label="Question types">
        {[...groups.keys()].map((label) => (
          <button
            key={label}
            type="button"
            role="tab"
            // The chip shows the short name ("MCQ"); assistive tech gets the full type name.
            aria-label={label}
            aria-selected={shown === label}
            onClick={() => onSelect(groups.get(label)![0]!.index)}
            className={cx(
              'flex min-w-0 justify-center overflow-hidden rounded-[36px] border-[1.5px] px-1 py-2.5 text-[12px] leading-4 font-bold text-ellipsis whitespace-nowrap',
              shown === label ? 'bg-info-700 border-info-700 text-on-brand' : 'border-info-50 text-neutral-900',
            )}
          >
            {chipLabel(label)}
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
                'border-info-50 flex items-center gap-3 rounded-[14px] border-[1.5px] p-[18px] text-left text-[14px] leading-4 font-semibold text-neutral-900',
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
  const { session, attempt, question, secondsLeft, onSubmit, onExit, onNext } = props;
  const [statusOpen, setStatusOpen] = useState(false);
  const { index } = attempt;
  // Multipart questions (case based, unseen passage …) show one sub-question at a time; Previous / Skip / Save & Next
  // step through the sub-questions before moving to another question. Another question starts at its first part.
  const [partOf, setPartOf] = useState({ questionId: question.id, part: 0 });
  const part = partOf.questionId === question.id ? partOf.part : 0;
  const goToPart = (next: number) => setPartOf({ questionId: question.id, part: next });
  const lastPart = question.kind === 'multipart' ? question.parts.length - 1 : 0;
  const nextQuestion = () => {
    attempt.leave(question.id);
    attempt.goTo(index + 1);
  };
  const previous = () => (part > 0 ? goToPart(part - 1) : attempt.goTo(index - 1));
  const saveAndNext = () => (part < lastPart ? goToPart(part + 1) : onNext());
  const skip = () => {
    if (question.kind !== 'multipart' || question.parts.length === 0) return attempt.skip();
    // Clears this sub-question's answer only; the question counts as skipped if it's left with no answer at all.
    const answer = attempt.snapshot.answers[question.id];
    const parts = { ...(answer?.kind === 'parts' ? answer.parts : {}) };
    delete parts[question.parts[part]!.id];
    attempt.answer(question.id, { kind: 'parts', parts });
    if (part < lastPart) goToPart(part + 1);
    else if (index < attempt.total - 1) nextQuestion();
    else attempt.leave(question.id);
  };
  const select = (i: number) => {
    attempt.goTo(i);
    setStatusOpen(false);
  };

  return (
    // Fills the screen under the fixed header (70px phones, 76px md+): the question scrolls, Previous / Next stay put.
    <div className="font-gilroy flex h-[calc(100dvh-70px)] flex-col overflow-hidden md:h-[calc(100dvh-76px)]">
      <div className="bg-info-25 border-info-50 shrink-0 border-b-[1.5px]">
        <div className="mx-auto flex h-[88px] max-w-[1440px] items-center gap-4 p-[14px] md:h-[112px] md:gap-7">
          <button type="button" onClick={onExit} aria-label="Back" className="text-foreground">
            <ArrowLeft aria-hidden className="size-6" />
          </button>
          <h1 className="m-0 flex-1 text-[18px] leading-[18px] font-semibold text-neutral-950">Assessment</h1>
          <p className="text-foreground-muted hidden text-xs sm:block" aria-live="polite">
            {attempt.isSaving ? 'Saving…' : attempt.saveFailed ? 'Not saved — will retry' : ''}
          </p>
          <button
            type="button"
            onClick={onSubmit}
            className="bg-info-700 border-info-700 text-on-brand rounded-[14px] border-[1.5px] px-[14px] py-[13px] text-[16px] leading-[22px] font-semibold hover:opacity-90"
          >
            Finish Quiz
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col md:flex-row">
        <div className={cx('flex min-h-0 w-full flex-1 flex-col gap-4 p-4 md:w-[66%] md:flex-none', gridBackdrop)}>
          <div className="flex shrink-0 items-center justify-between gap-3 md:hidden">
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
          <div
            className="bg-surface border-info-50 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border-2 shadow-sm"
            data-testid="question-scroll"
          >
            <section>
              <QuestionView
                key={question.id}
                look="board"
                question={question}
                number={index + 1}
                answer={attempt.snapshot.answers[question.id]}
                onAnswer={(value) => attempt.answer(question.id, value)}
                draftKey={`answer:${session.key}:${question.id}`}
                partIndex={question.kind === 'multipart' ? part : undefined}
              />
            </section>
          </div>
          <footer className="flex shrink-0 items-center gap-[5px] md:gap-[18px]">
            <button
              type="button"
              disabled={index === 0 && part === 0}
              onClick={previous}
              className="border-info-700 text-info-700 disabled:bg-neutral-350 disabled:text-on-brand flex items-center justify-center rounded-[14px] border-[1.5px] px-[18px] py-[13px] text-[16px] leading-[22px] font-semibold disabled:cursor-not-allowed disabled:border-transparent"
            >
              <ChevronLeft aria-hidden className="size-4" />
              Previous
            </button>
            <button
              type="button"
              onClick={skip}
              className="border-info-700 text-info-700 bg-surface ml-auto flex items-center justify-center rounded-[14px] border-[1.5px] px-[18px] py-[13px] text-[16px] leading-[22px] font-semibold hover:ring-2 hover:ring-inset"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={saveAndNext}
              className="bg-info-700 border-info-700 text-on-brand flex items-center justify-center rounded-[14px] border-[1.5px] px-[18px] py-[13px] text-[16px] leading-[22px] font-semibold hover:opacity-90"
            >
              Save &amp; Next
            </button>
          </footer>
        </div>
        <aside className="bg-surface border-info-50 hidden w-[34%] shrink-0 overflow-y-auto border-[1.5px] p-[44px] md:block">
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
