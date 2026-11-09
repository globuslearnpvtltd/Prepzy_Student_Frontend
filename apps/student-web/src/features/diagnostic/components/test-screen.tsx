'use client';

import { cx, PaletteItem } from '@prepzy/design-system';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { RichText } from '@/features/exam-engine/ui';
import { useExam } from '@/shared/hooks/use-exam';
import { BackButton, Breadcrumb, Notice, ScreenLoader } from '@/features/study-plan/ui';
import { routes } from '@/shared/config/routes';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { attemptReducer, diagnosticApi, formatClock, isCase, statusCounts, type AttemptAction, type DiagnosticQuestion, type QuestionStatus } from '../api';

const SAVE_DELAY = 2000;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PALETTE_STATUS: Record<QuestionStatus, 'answered' | 'skipped' | 'marked' | 'not-visited'> = {
  answered: 'answered',
  skipped: 'skipped',
  marked_for_review: 'marked',
  not_visited: 'not-visited',
};

type State = { questions: DiagnosticQuestion[]; index: number };
type Action = AttemptAction | { type: 'load'; questions: DiagnosticQuestion[] } | { type: 'go'; index: number };

function reducer(state: State, action: Action): State {
  if (action.type === 'load') return { questions: action.questions, index: 0 };
  if (action.type === 'go') return { ...state, index: Math.max(0, Math.min(state.questions.length - 1, action.index)) };
  return { ...state, questions: attemptReducer(state.questions, action) };
}

function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const expired = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.round((deadline - Date.now()) / 1000);
      setLeft(next);
      if (next <= 0 && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);
  return (
    <span
      role="timer"
      aria-label="Time left"
      className={cx(
        'bg-surface flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] font-bold tabular-nums shadow-[0px_8px_16px_-4px_rgba(61,52,139,0.1)]',
        left <= 60 ? 'text-danger' : 'text-neutral-950',
      )}
    >
      <Clock aria-hidden className="size-4" />
      {formatClock(left)}
    </span>
  );
}

function Option({ index, html, image, selected, onSelect }: { index: number; html: string; image: string | null; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'bg-surface flex w-full items-center gap-4 rounded-lg border-2 p-4 text-left',
        selected ? 'border-brand shadow-[0px_4px_12px_rgba(61,52,139,0.25)]' : 'border-neutral-150 hover:border-brand-300',
      )}
    >
      <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold', selected ? 'bg-brand text-on-brand' : 'bg-brand-50 text-neutral-500')}>
        {LETTERS[index] ?? index + 1}
      </span>
      <span className="min-w-0 flex-1 text-[15px] text-neutral-900">
        <RichText html={html} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image && <img src={image} alt="" className="mt-2 max-h-40 rounded-sm" />}
      </span>
    </button>
  );
}

function QuestionView({ question, number, dispatch }: { question: DiagnosticQuestion; number: number; dispatch: (action: AttemptAction) => void }) {
  const picked = !isCase(question) && question.selected_answer && !Array.isArray(question.selected_answer) ? question.selected_answer.option_index : null;
  const subPicks = Array.isArray(question.selected_answer) ? question.selected_answer : [];
  return (
    <div className="bg-surface flex flex-col gap-5 rounded-2xl p-5 shadow-[0px_0px_25px_-5px_rgba(30,30,30,0.15)] md:p-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-brand text-[14px] font-bold">Question {number}</span>
        <span className="bg-brand-50 text-brand rounded-full px-3 py-1 text-[12px] font-semibold">{question.subject_name}</span>
      </div>
      <div className="text-[16px] leading-[1.6] font-medium text-neutral-900">
        <RichText html={question.question_text} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {question.question_image && <img src={question.question_image} alt="" className="mt-3 max-h-64 rounded-sm" />}
      </div>
      {isCase(question) ? (
        question.sub_questions.map((sub, n) => (
          <div key={sub.sub_index} className="border-neutral-150 flex flex-col gap-3 rounded-lg border bg-neutral-50 p-4">
            <div className="text-[15px] font-medium text-neutral-900">
              <span className="text-brand mr-1 font-bold">({String.fromCharCode(97 + n)})</span>
              <RichText html={sub.sub_question_text} className="inline" />
            </div>
            <div role="radiogroup" aria-label={`Part ${n + 1}`} className="flex flex-col gap-3">
              {sub.options.map((option, i) => (
                <Option
                  key={option.option_index}
                  index={i}
                  html={option.option_text}
                  image={option.option_image}
                  selected={subPicks.some((p) => p.sub_index === sub.sub_index && p.option_index === option.option_index)}
                  onSelect={() => dispatch({ type: 'select-sub', questionId: question.question_id, subIndex: sub.sub_index, optionIndex: option.option_index })}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div role="radiogroup" aria-label="Options" className="flex flex-col gap-3">
          {question.options.map((option, i) => (
            <Option
              key={option.option_index}
              index={i}
              html={option.option_text}
              image={option.option_image}
              selected={picked === option.option_index}
              onSelect={() => dispatch({ type: 'select', questionId: question.question_id, optionIndex: option.option_index })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Palette({ questions, index, onJump, scroll }: { questions: DiagnosticQuestion[]; index: number; onJump: (i: number) => void; scroll?: boolean }) {
  return (
    <div className={cx('border-neutral-150 bg-surface rounded-xl border p-5', scroll ? 'overflow-x-auto' : '')}>
      <p className="mb-3 text-[14px] font-bold text-neutral-950">Questions</p>
      <div className={cx('gap-3', scroll ? 'flex' : 'grid grid-cols-6')}>
        {questions.map((q, i) => (
          <PaletteItem
            key={q.question_id}
            number={i + 1}
            status={PALETTE_STATUS[q.status]}
            current={i === index ? 'yes' : 'no'}
            statusLabel={q.status.replace(/_/g, ' ')}
            onClick={() => onJump(i)}
            className="shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

function Legend({ questions }: { questions: DiagnosticQuestion[] }) {
  const counts = statusCounts(questions);
  const items = [
    { label: 'Answered', value: counts.answered, className: 'bg-success-400 text-on-brand' },
    { label: 'Not answered', value: counts.notAnswered, className: 'bg-accent-400 text-on-brand' },
    { label: 'Marked for review', value: counts.marked, className: 'bg-brand text-on-brand' },
    { label: 'Not visited', value: counts.notVisited, className: 'bg-neutral-150 text-neutral-500 border border-neutral-300' },
  ];
  return (
    <div className="border-neutral-150 bg-surface grid grid-cols-2 gap-3 rounded-xl border p-5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2 text-[13px] font-medium text-neutral-700">
          <span className={cx('flex size-7 items-center justify-center rounded-sm text-[12px] font-bold', item.className)}>{item.value}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

const EVALUATING = ['Verifying Submitted Answers', 'Calculating Total Score', 'Preparing Performance Summary'];

function Evaluating({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= EVALUATING.length) {
      onDone();
      return;
    }
    const id = setTimeout(() => setDone((d) => d + 1), 700);
    return () => clearTimeout(id);
  }, [done, onDone]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Evaluating your test" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/30 p-5 backdrop-blur-[6px]">
      <div className="bg-surface border-neutral-150 flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border p-6 shadow-lg">
        <h2 className="text-[20px] font-bold text-neutral-900">Evaluating your test</h2>
        <ul className="flex flex-col gap-3 rounded-lg bg-neutral-50 p-4">
          {EVALUATING.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-[14px] font-medium text-neutral-650">
              {i < done ? <Check aria-hidden className="text-success-700 size-5" /> : <Loader2 aria-hidden className={cx('size-5', i === done ? 'text-brand animate-spin' : 'text-brand/30')} />}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The timed diagnostic test: one question at a time, palette, autosave, submit → result. */
export function DiagnosticTestScreen({ assessmentId }: { assessmentId: string }) {
  const exam = useExam();
  const router = useRouter();
  const session = useQuery({
    queryKey: ['diagnostic', 'questions', assessmentId],
    queryFn: () => diagnosticApi.questions(assessmentId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [state, dispatch] = useReducer(reducer, { questions: [], index: 0 });
  const latest = useRef(state.questions);
  latest.current = state.questions;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);
  const [evaluating, setEvaluating] = useState(false);
  const resultHref = routes.diagnosticResult(exam.slug, assessmentId);

  useEffect(() => {
    if (session.data) dispatch({ type: 'load', questions: session.data.questions });
  }, [session.data]);

  // Already submitted / expired → the report.
  useEffect(() => {
    if (isApiError(session.error) && session.error.status === 400) router.replace(routes.diagnosticResult(exam.slug));
  }, [session.error, router, exam.slug]);

  const saveSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!submitted.current && latest.current.length) void diagnosticApi.save(assessmentId, latest.current).catch(() => undefined);
    }, SAVE_DELAY);
  }, [assessmentId]);

  useEffect(() => {
    const flush = () => {
      if (!submitted.current && latest.current.length) void diagnosticApi.save(assessmentId, latest.current, true);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [assessmentId]);

  const submit = useMutation({
    mutationFn: () => diagnosticApi.submit(assessmentId, latest.current),
    onError: () => {
      submitted.current = false;
      setEvaluating(false);
    },
  });

  const act = (action: AttemptAction | { type: 'go'; index: number }, leave = false) => {
    const current = state.questions[state.index];
    if (leave && current) dispatch({ type: 'leave', questionId: current.question_id });
    dispatch(action);
    saveSoon();
  };

  const handleSubmit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    if (timer.current) clearTimeout(timer.current);
    setEvaluating(true);
    submit.mutate();
  }, [submit]);

  const [animationDone, setAnimationDone] = useState(false);
  const finishAnimation = useCallback(() => setAnimationDone(true), []);
  useEffect(() => {
    if (animationDone && submit.isSuccess) router.replace(resultHref);
  }, [animationDone, submit.isSuccess, router, resultHref]);

  if (session.isError && !(isApiError(session.error) && session.error.status === 400))
    return <Notice tone="danger" title="Couldn't load this test" body={userMessage(session.error, 'Something went wrong while loading the test.')} action={{ label: 'Go back', href: routes.dashboard(exam.slug) }} />;
  if (submit.isError)
    return <Notice tone="danger" title="Couldn't load this test" body="We couldn't submit your test. Please try again." action={{ label: 'Try again', onClick: () => submit.reset() }} />;
  if (session.isPending || (session.data && !state.questions.length && session.data.questions.length))
    return <ScreenLoader message="Preparing Your Diagnostic" sub="Picking questions from the chapters you selected..." />;
  const current = state.questions[state.index];
  if (!current) return <Notice title="Couldn't load this test" body="No questions found for this diagnostic." action={{ label: 'Go back', href: routes.dashboard(exam.slug) }} />;
  const isLast = state.index === state.questions.length - 1;
  const marked = current.status === 'marked_for_review';
  const jump = (i: number) => act({ type: 'go', index: i }, true);

  return (
    <div className="w-full py-4">
      <div className="border-neutral-150 flex items-center justify-between gap-4 md:mb-6 md:h-20 md:rounded-2xl md:border md:bg-surface md:px-5 md:shadow-[0px_16px_40px_rgba(61,52,139,0.08)]">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton href={routes.dashboard(exam.slug)} label="Back to dashboard" />
          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <Link href={routes.dashboard(exam.slug)} className="text-brand text-[14px] font-semibold hover:opacity-70">
              Dashboard
            </Link>
            <ChevronRight aria-hidden className="text-neutral-350 size-4" />
            <span className="truncate text-[14px] text-neutral-600">Diagnostic test</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          {session.data?.timeLeft !== null && session.data?.timeLeft !== undefined && <Timer seconds={session.data.timeLeft} onExpire={handleSubmit} />}
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'leave', questionId: current.question_id });
              handleSubmit();
            }}
            className="bg-brand border-brand text-on-brand flex items-center gap-2 rounded-lg border px-3 py-2 text-[14px] font-semibold hover:opacity-90 md:h-9 md:px-[15px] md:text-[13px]"
          >
            Submit Test
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <Breadcrumb dashboardHref={routes.dashboard(exam.slug)} current="Diagnostic test" className="mt-4 mb-5 md:hidden" />
      <div className="mb-5 min-w-0 lg:hidden">
        <Palette questions={state.questions} index={state.index} onJump={jump} scroll />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <QuestionView question={current} number={state.index + 1} dispatch={(action) => act(action)} />
          <div className="border-neutral-150 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-neutral-50 p-4">
            <button
              type="button"
              disabled={state.index === 0}
              onClick={() => act({ type: 'go', index: state.index - 1 }, true)}
              className="text-brand flex items-center gap-2 text-[14px] font-semibold disabled:opacity-40"
            >
              <ArrowLeft aria-hidden className="size-4" /> Previous
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => act({ type: 'toggle-review', questionId: current.question_id })}
                aria-pressed={marked}
                className={cx('flex items-center gap-2 rounded-md border px-4 py-2 text-[14px] font-semibold', marked ? 'bg-brand-50 border-brand text-brand' : 'bg-surface border-neutral-150 text-neutral-700')}
              >
                <Bookmark aria-hidden className="size-4" />
                {marked ? 'Unmark review' : 'Mark for review'}
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'leave', questionId: current.question_id });
                    handleSubmit();
                  }}
                  className="bg-brand text-on-brand rounded-md px-5 py-2 text-[14px] font-semibold"
                >
                  Submit Test
                </button>
              ) : (
                <button type="button" onClick={() => act({ type: 'go', index: state.index + 1 }, true)} className="bg-brand text-on-brand flex items-center gap-2 rounded-md px-5 py-2 text-[14px] font-semibold">
                  Save &amp; Next <ArrowRight aria-hidden className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="hidden w-full shrink-0 flex-col gap-6 lg:flex lg:w-[413px]">
          <Legend questions={state.questions} />
          <Palette questions={state.questions} index={state.index} onJump={jump} />
        </div>
      </div>
      {evaluating && <Evaluating onDone={finishAnimation} />}
    </div>
  );
}
