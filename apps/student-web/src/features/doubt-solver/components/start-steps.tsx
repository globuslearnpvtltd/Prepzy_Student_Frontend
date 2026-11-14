'use client';

import { ChevronRight, Camera } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { Composer, SOCRATES_IMAGE } from '@/features/assistant/ui';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { formatSubject, shortSubject, solverApi, type SolvePayload } from '../api';
import { useSolver } from '../store';
import { BookCover } from './subject-picker';

/** Step 2: the chosen book, then "Ask your own doubt" or "Solve from Question Bank". */
export function StartOptions({ onAsk, onQuestionBank, onChangeSubject }: { onAsk: () => void; onQuestionBank: () => void; onChangeSubject: () => void }) {
  const exam = useExam();
  const plan = useActivePlan(exam);
  const { subject, book } = useSolver();
  return (
    <div className="flex min-h-full w-full max-w-[710px] flex-col items-center max-md:pt-10">
      {book && (
        <>
          <span className="relative">
            <span aria-hidden className="bg-accent-300/40 absolute -inset-6 rounded-full blur-2xl" />
            <BookCover book={book} className="h-[176px] w-[124px] md:h-[162px] md:w-[121px]" />
          </span>
          <p className="text-socrates-gold mt-5 text-[18px] leading-6 font-semibold md:text-[20px]">{subject ? shortSubject(subject.title) : ''}</p>
          <p className="text-socrates-body mt-1 text-[14px]">{book.title}</p>
          {book.className && (
            <p className="text-socrates-muted mt-1 text-[12.5px]">
              {formatSubject(book.className)}
              {plan.data?.streamName ? ` (${formatSubject(plan.data.streamName)})` : ''}
            </p>
          )}
        </>
      )}
      <section className="bg-surface shadow-socrates-card mt-8 w-full rounded-[22px] px-4 pt-5 pb-4 max-md:mt-auto max-md:rounded-b-none max-md:pb-6">
        <span aria-hidden className="bg-socrates-line mx-auto -mt-2 mb-3 block h-1 w-10 rounded-full md:hidden" />
        <h2 className="text-socrates-ink text-center font-serif text-[22px] leading-7 font-semibold md:text-[26px] md:leading-8">How do you want to start?</h2>
        <p className="text-socrates-muted mt-1.5 text-center text-[12.5px]">Pick one. You can switch any time.</p>
        <div className="mt-4 grid gap-2.5 md:grid-cols-2">
          <OptionCard
            title="Ask your own doubt"
            text="Type it, write it with math input, or snap a photo."
            action="Start"
            onClick={onAsk}
            art={
              <span className="bg-socrates-soft grid size-[84px] shrink-0 grid-cols-2 place-items-center gap-1 rounded-md p-1.5">
                <span className="bg-surface text-socrates-text flex size-[34px] items-center justify-center rounded-full text-[10px]">Aa</span>
                <span className="bg-surface text-socrates-text flex size-[34px] items-center justify-center rounded-full font-serif text-[12px] italic">fx</span>
                <span className="bg-surface text-socrates-text col-span-2 flex size-[34px] items-center justify-center rounded-full">
                  <Camera aria-hidden className="size-3" />
                </span>
              </span>
            }
          />
          <OptionCard
            title="Solve from Question Bank"
            text="Chapter-wise unsolved questions and PYQ's."
            action="Open"
            onClick={onQuestionBank}
            art={
              <span className="bg-socrates-soft relative block size-[84px] shrink-0 overflow-hidden rounded-md">
                <span className="bg-surface shadow-sm absolute top-2.5 left-1.5 h-7 w-[60px] -rotate-6 rounded-sm px-1 pt-1 text-[6px] text-socrates-muted">PYQ&apos;s · 2024</span>
                <span className="bg-surface shadow-sm absolute top-10 left-4 h-9 w-[62px] rounded-sm px-1 pt-1 text-[5.5px] font-semibold text-socrates-text">
                  CHAPTER 6 <span className="bg-brand text-on-brand rounded-full px-1">Solve</span>
                </span>
              </span>
            }
          />
        </div>
        <button type="button" onClick={onChangeSubject} className="text-brand mx-auto mt-3 block text-[12px] font-semibold">
          Change subject
        </button>
      </section>
    </div>
  );
}

function OptionCard({ title, text, action, onClick, art }: { title: string; text: string; action: string; onClick: () => void; art: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="border-neutral-200 hover:border-brand-300 flex items-center gap-2.5 rounded-[18px] border p-2 text-left">
      {art}
      <span className="flex min-w-0 flex-col">
        <span className="text-socrates-ink text-[16px] leading-5 font-semibold">{title}</span>
        <span className="text-socrates-muted mt-0.5 text-[11.5px] leading-[14px]">{text}</span>
        <span className="text-brand mt-1 flex items-center gap-0.5 text-[13px] font-semibold">
          {action} <ChevronRight aria-hidden className="size-3" />
        </span>
      </span>
    </button>
  );
}

/** Step 3: type a question (or snap a photo); it's checked for the subject, then Socrates starts. */
export function AskDoubt({ onSolve }: { onSolve: (payload: SolvePayload) => void }) {
  const exam = useExam();
  const { subject } = useSolver();
  const [busy, setBusy] = useState<null | 'reading' | 'checking'>(null);
  const [error, setError] = useState<string | null>(null);
  const subjectName = subject ? shortSubject(subject.title) : 'Subject';

  const ask = async (text: string, image: File | null) => {
    setError(null);
    try {
      let display = text;
      let problem = text;
      let images: string[] = [];
      if (image) {
        setBusy('reading');
        const read = await solverApi.extractQuestion(exam, image);
        if (!read.text && !text) {
          setError("We couldn't read a question in that picture. Please try again or type it.");
          return;
        }
        display = [read.text, text].filter(Boolean).join('\n');
        problem = display;
        const diagrams = read.diagrams.filter((d) => d.description);
        if (diagrams.length) problem += `\n\nDiagrams:\n${diagrams.map((d, i) => `Diagram ${i + 1}: ${d.description}`).join('\n')}`;
        images = read.diagrams.filter((d) => d.base64).map((d) => (d.base64.startsWith('data:') ? d.base64 : `data:image/png;base64,${d.base64}`));
      }
      setBusy('checking');
      const valid = await solverApi.checkQuestion(exam, subject, problem);
      if (!valid) {
        setError(`This doesn't look like a valid ${subjectName} problem. Please edit the problem.`);
        return;
      }
      onSolve({ problem, display, images });
    } catch (cause) {
      setError(userMessage(cause) || 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex w-full max-w-[616px] flex-col items-center">
      <Image
        src={SOCRATES_IMAGE}
        alt=""
        width={68}
        height={68}
        className="border-surface from-socrates-panel-from to-socrates-panel-to shadow-socrates-card size-[68px] rounded-full border-[3px] bg-linear-to-b object-cover object-top"
      />
      <h1 className="text-socrates-ink mt-3 text-center font-serif text-[24px] leading-8 font-bold md:text-[28px]">What&apos;s your {subjectName} doubt?</h1>
      <p className="text-socrates-muted mt-1.5 text-center text-[12.5px]">Type it, use fx for formulas, tap + to snap a photo or the pen to write it by hand.</p>
      <Composer
        className="mt-6 w-full"
        placeholder="Type or snap your question"
        onSend={(text, image) => void ask(text, image)}
        disabled={busy !== null}
        autoFocus
        // A handwritten question is read like a photo of one (extract-question).
        allowInk
        inkDraftKey={`socrates:ask:${subject?.id ?? 'any'}`}
      />
      {busy && (
        <p role="status" className="text-socrates-muted mt-3 text-[12.5px]">
          {busy === 'reading' ? 'Reading your picture…' : 'Checking your question…'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-socrates-error mt-3 text-center text-[12.5px]">
          {error}
        </p>
      )}
    </div>
  );
}
