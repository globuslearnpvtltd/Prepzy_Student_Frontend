'use client';

import { Button, OptionGroup, OptionTile, cx } from '@prepzy/design-system';
import { useId } from 'react';
import type { ExamCategory } from '@/shared/config/exams';
import type { Answer, ExamQuestion, WrittenAnswer } from '../model';
import { AnswerBox } from './answer-box';
import { RichText } from './rich-text';

const EMPTY_WRITTEN: WrittenAnswer = { text: '', images: [] };

/** Option tiles in the board player: light blue cards with a radio circle (previous app's McqOptions). */
const boardOption =
  'bg-info-25 border-info-50 min-h-[70px] rounded-[10px] px-6 data-[state=checked]:border-info-700 data-[state=checked]:bg-info-50 [&>span:first-child]:size-5 [&>span:first-child]:border [&>span:first-child]:border-neutral-300 [&>span:first-child]:bg-surface data-[state=checked]:[&>span:first-child]:border-[6px] data-[state=checked]:[&>span:first-child]:border-info-700';

/**
 * One question. `look` follows the exam category's player: board papers show "1. question" on a blue header
 * strip; competitive papers show a "Question 1" chip and lettered options.
 */
export function QuestionView({
  question,
  number,
  answer,
  onAnswer,
  look = 'competitive',
  draftKey,
}: {
  question: ExamQuestion;
  number: number;
  answer: Answer | undefined;
  onAnswer: (answer: Answer | null) => void;
  look?: Exclude<ExamCategory, 'reference'>;
  /** This attempt + question: handwriting drafts of written answers are kept per question. */
  draftKey?: string;
}) {
  const headingId = useId();
  const board = look === 'board';
  return (
    <article aria-labelledby={headingId} className="flex flex-col">
      {board ? (
        <header className="bg-info-25 border-info-50 flex flex-col gap-3 border-b px-6 py-6">
          <h2 id={headingId} className="sr-only">
            Question {number}
          </h2>
          <div className="flex gap-2 text-[16px] leading-6">
            <span className="text-foreground font-semibold" aria-hidden>
              {number}.
            </span>
            <RichText html={question.html} className="text-brand-950 min-w-0 flex-1" />
          </div>
          {question.marks !== null && (
            <p className="text-foreground-muted text-xs font-medium">
              {question.typeLabel} · {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
            </p>
          )}
        </header>
      ) : (
        <header className="flex flex-col gap-4">
          <h2
            id={headingId}
            className="bg-brand-75 text-brand w-fit rounded-md px-4 py-1.5 text-[11px] leading-4 font-semibold"
          >
            Question {number}
          </h2>
          <RichText html={question.html} className="text-[16px] leading-7 text-neutral-700" />
        </header>
      )}
      {question.image && (
        // eslint-disable-next-line @next/next/no-img-element -- backend images from arbitrary CDNs
        <img
          src={question.image}
          alt=""
          className={cx('border-border max-h-80 w-auto rounded-md border', board ? 'mx-6 mt-4' : 'mt-4')}
          loading="lazy"
        />
      )}

      <div className={cx('flex flex-col gap-4', board ? 'p-6' : 'mt-10')}>
        {question.kind === 'mcq' && (
          <>
            {!board && (
              <p className="text-sm font-medium text-neutral-800">Choose the correct answer from the options given below:</p>
            )}
            <OptionGroup
              aria-labelledby={headingId}
              value={answer?.kind === 'option' ? answer.optionId : ''}
              onValueChange={(optionId) => onAnswer({ kind: 'option', optionId })}
              className={board ? 'gap-[18px]' : 'gap-4'}
            >
              {question.options.map((option, i) => (
                <OptionTile
                  key={option.id}
                  value={option.id}
                  marker={board ? '' : String.fromCharCode(65 + i)}
                  className={board ? boardOption : 'min-h-[60px] border-2 px-6'}
                >
                  <RichText html={option.html} />
                  {option.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.image} alt="" className="mt-2 max-h-40 w-auto rounded-sm" loading="lazy" />
                  )}
                </OptionTile>
              ))}
            </OptionGroup>
            {answer && (
              <Button intent="ghost" size="sm" className="self-start" onClick={() => onAnswer(null)}>
                Clear response
              </Button>
            )}
          </>
        )}

        {question.kind === 'written' && (
          <AnswerBox
            label="Your answer"
            inkDraftKey={draftKey}
            value={answer?.kind === 'written' ? answer : EMPTY_WRITTEN}
            onChange={(value) => onAnswer({ kind: 'written', ...value })}
          />
        )}

        {question.kind === 'multipart' &&
          question.parts.map((part, i) => {
            const parts = answer?.kind === 'parts' ? answer.parts : {};
            const letter = String.fromCharCode(97 + i);
            return (
              <section key={part.id} className="border-info-50 flex flex-col gap-3 rounded-[14px] border-[1.5px] p-4">
                <p className="text-sm font-semibold">
                  Part {letter}
                  {part.marks !== null && <span className="text-foreground-muted font-normal"> · {part.marks} marks</span>}
                </p>
                <RichText html={part.html} />
                {part.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={part.image} alt="" className="max-h-60 w-auto rounded-md" loading="lazy" />
                )}
                <AnswerBox
                  label={`Answer for part ${letter}`}
                  inkDraftKey={draftKey && `${draftKey}:${part.id}`}
                  value={parts[part.id] ?? EMPTY_WRITTEN}
                  onChange={(value) => onAnswer({ kind: 'parts', parts: { ...parts, [part.id]: value } })}
                />
              </section>
            );
          })}
      </div>
    </article>
  );
}
