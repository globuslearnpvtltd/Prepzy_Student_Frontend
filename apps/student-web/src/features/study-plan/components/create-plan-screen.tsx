'use client';

import { cx } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardPen, Info, Lock, Minus, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { routes } from '@/shared/config/routes';
import {
  formatMask,
  formatPlanDate,
  formatStudyHours,
  infeasibleCopy,
  isoToMask,
  maskToIso,
  monthCells,
  monthLabel,
  studyPlanApi,
  toIso,
  type PlanType,
} from '../api';
import { useStudyPlanDraft } from '../draft-store';
import { useClassContext, usePlanStatus } from '../hooks';
import { Notice, ScreenLoader } from './kit';

const TOTAL_STEPS = 3;
const MIN_MINUTES = 30;
const MAX_MINUTES = 600;
const STEP = 30;
const PRESETS = [30, 60, 120, 180];
const MAX_PLAN_DAYS = 365;

const BLOCKED: Record<string, { title: string; body: string; action: string }> = {
  diagnostic_used: {
    title: 'This diagnostic has already been used',
    body: 'Every study plan is built from its own diagnostic test. Take a fresh one and you can build a new plan from it.',
    action: 'Take a new test',
  },
  needs_diagnostic: { title: 'Take the diagnostic first', body: 'A study plan is built from a recent diagnostic test.', action: 'Take the test' },
};

function QuestionCard({ step, label, children }: { step: number; label: string; children: ReactNode }) {
  return (
    <div className="border-neutral-150 flex flex-col gap-5 rounded-2xl border bg-neutral-50 p-6 md:gap-[14px] md:rounded-xl md:p-[18px]">
      <div className="flex items-start gap-3 md:items-center md:gap-[10px]">
        <span className="bg-brand text-on-brand flex size-6 shrink-0 items-center justify-center rounded-md text-[12px] leading-none font-semibold">{step}</span>
        <span className="text-brand pt-[3px] text-[12px] leading-[18px] font-semibold tracking-[0.45px] uppercase md:pt-0">{label}</span>
      </div>
      {children}
    </div>
  );
}

const PLAN_OPTIONS: { value: PlanType; title: string; description: string; Icon: typeof BookOpen }[] = [
  { value: 'learning_cum_practice', title: 'Learn & Practice Concepts', description: 'Build concepts and practice weak topics.', Icon: ClipboardPen },
  { value: 'revision', title: 'Revise', description: 'For quick recall what you already been taught.', Icon: BookOpen },
];

function PlanTypeStep({ value, allowed, onChange }: { value: PlanType | null; allowed: PlanType[]; onChange: (v: PlanType) => void }) {
  return (
    <QuestionCard step={1} label="What should this plan do?">
      <div className="flex flex-col gap-[14px] md:gap-2" role="radiogroup" aria-label="Plan type">
        {PLAN_OPTIONS.map(({ value: option, title, description, Icon }) => {
          const locked = !allowed.includes(option);
          const selected = value === option && !locked;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onChange(option)}
              className={cx(
                'flex min-h-[74px] items-center gap-3 rounded-lg px-[18px] py-4 text-left disabled:cursor-not-allowed md:min-h-0 md:gap-[14px] md:p-4',
                locked ? 'border-neutral-150 border-[1.5px] bg-neutral-50' : selected ? 'bg-brand-175 border-brand border-2' : 'bg-surface border-neutral-150 border-[1.5px]',
              )}
            >
              <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-[10px] md:size-[38px]', selected ? 'bg-surface' : 'bg-brand-25')}>
                <Icon aria-hidden className={cx('size-5', locked ? 'text-neutral-900/40' : 'text-brand')} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className={cx('text-[15px] leading-[22px] font-bold md:text-[14px]', locked ? 'text-neutral-900/40' : 'text-neutral-900')}>{title}</span>
                <span className={cx('hidden text-[12px] leading-[18px] md:block', locked ? 'text-neutral-900/40' : 'text-neutral-900/70')}>{description}</span>
              </span>
              {locked && <Lock aria-label="Not available" className="size-[14px] shrink-0 text-neutral-900/40" />}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function DailyMinutesStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const clamp = (m: number) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));
  const control = (kind: 'minus' | 'plus') => {
    const disabled = kind === 'minus' ? value <= MIN_MINUTES : value >= MAX_MINUTES;
    const Icon = kind === 'minus' ? Minus : Plus;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={kind === 'minus' ? 'Decrease by 30 minutes' : 'Increase by 30 minutes'}
        onClick={() => onChange(clamp(value + (kind === 'minus' ? -STEP : STEP)))}
        className="bg-surface border-neutral-150 flex size-10 shrink-0 items-center justify-center self-center rounded-[10px] border-[1.5px] shadow-[0px_4px_12px_rgba(61,52,139,0.05)] disabled:cursor-not-allowed disabled:shadow-none md:size-12 md:rounded-lg"
      >
        <Icon aria-hidden className={cx('size-[18px]', disabled ? 'text-neutral-900/30' : 'text-neutral-900')} strokeWidth={2.5} />
      </button>
    );
  };
  return (
    <QuestionCard step={2} label="How much time can you give per day?">
      <div className="flex flex-col gap-7 md:gap-[14px]">
        <div className="flex items-stretch gap-3 md:gap-[14px]">
          {control('minus')}
          <div className="md:bg-surface flex flex-1 flex-col items-center justify-center gap-[2px] md:rounded-[17px] md:px-[14px] md:py-[10px] md:shadow-[0px_10px_24px_rgba(61,52,139,0.08)]">
            <span className="text-brand text-[11px] leading-4 font-semibold tracking-[0.82px] uppercase">Study timer</span>
            <span aria-live="polite" className="text-[24px] leading-8 font-bold text-neutral-900 tabular-nums md:text-[34px] md:leading-[50px]">
              {formatStudyHours(value)}
            </span>
          </div>
          {control('plus')}
        </div>
        <div className="flex gap-2 md:gap-[7px]">
          {PRESETS.map((preset, index) => (
            <button
              key={preset}
              type="button"
              aria-pressed={value === preset}
              onClick={() => onChange(preset)}
              className={cx(
                'h-10 flex-1 items-center justify-center rounded-md border-[1.5px] text-[14px] md:flex md:h-12 md:rounded-lg',
                index >= 3 ? 'hidden' : 'flex',
                value === preset ? 'bg-brand border-brand text-on-brand font-bold shadow-[0px_8px_20px_rgba(61,52,139,0.12)]' : 'bg-surface border-neutral-150 font-semibold text-neutral-900',
              )}
            >
              {formatStudyHours(preset)}
            </button>
          ))}
        </div>
      </div>
    </QuestionCard>
  );
}

function DatePicker({ value, min, max, onPick }: { value: string | null; min: string; max: string; onPick: (iso: string) => void }) {
  const start = value ?? min;
  const [view, setView] = useState(Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1);
  const year = Math.floor(view / 12);
  const month = view % 12;
  const minView = Number(min.slice(0, 4)) * 12 + Number(min.slice(5, 7)) - 1;
  const maxView = Number(max.slice(0, 4)) * 12 + Number(max.slice(5, 7)) - 1;
  return (
    <div role="dialog" aria-label="Choose a date" className="bg-surface border-neutral-150 w-full max-w-[340px] rounded-xl border p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={view <= minView} onClick={() => setView(view - 1)} className="bg-brand-25 border-neutral-150 text-brand flex size-8 items-center justify-center rounded-sm border disabled:opacity-40">
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="text-brand text-[14px] font-bold">{monthLabel(year, month)}</span>
        <button type="button" aria-label="Next month" disabled={view >= maxView} onClick={() => setView(view + 1)} className="bg-brand-25 border-neutral-150 text-brand flex size-8 items-center justify-center rounded-sm border disabled:opacity-40">
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-neutral-650 text-[11px] font-semibold">
            {d}
          </span>
        ))}
        {monthCells(year, month).map((day, i) => {
          if (day === null) return <span key={i} />;
          const iso = toIso(new Date(year, month, day));
          const disabled = iso < min || iso > max;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              aria-label={iso}
              className={cx(
                'h-9 rounded-sm border text-[13px] font-medium disabled:cursor-not-allowed disabled:text-neutral-900/20',
                iso === value ? 'bg-brand border-brand text-on-brand' : 'border-neutral-150 bg-neutral-50 text-neutral-900',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TargetDateStep({ value, onChange, maxDate, examDate }: { value: string | null; onChange: (iso: string | null) => void; maxDate: string | null; examDate: string | null }) {
  const [mask, setMask] = useState(value ? isoToMask(value) : '');
  const [open, setOpen] = useState(false);
  const min = toIso(new Date());
  const max = useMemo(() => {
    if (maxDate) return maxDate;
    const last = new Date();
    last.setDate(last.getDate() + MAX_PLAN_DAYS - 1);
    return toIso(last);
  }, [maxDate]);
  const type = (raw: string) => {
    const next = formatMask(raw);
    setMask(next);
    const iso = maskToIso(next);
    onChange(iso && iso >= min && iso <= max ? iso : null);
  };
  const showError = mask.replace(/\D/g, '').length === 8 && !value;
  return (
    <QuestionCard step={3} label="What is your target completion date?">
      <div className="flex flex-col gap-[14px]">
        <div className="relative">
          <div
            className={cx(
              'bg-surface flex h-[98px] items-center gap-[14px] rounded-[22px] border-2 px-5 shadow-[0px_8px_20px_rgba(61,52,139,0.08)] md:h-[82px] md:rounded-xl md:px-[18px]',
              showError ? 'border-danger' : 'border-brand',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-[6px] md:gap-px">
              <label htmlFor="study-plan-target-date" className="text-brand text-[12px] leading-[18px] font-semibold tracking-[0.45px] uppercase md:text-[11px]">
                <span className="md:hidden">Target date</span>
                <span className="hidden md:inline">Target completion date</span>
              </label>
              <input
                id="study-plan-target-date"
                inputMode="numeric"
                autoComplete="off"
                placeholder="DD / MM / YYYY"
                value={mask}
                onChange={(e) => type(e.target.value)}
                className={cx('placeholder:text-neutral-350 w-full bg-transparent text-[16px] leading-[26px] text-neutral-900 outline-none md:text-[17px]', mask ? 'font-bold' : 'font-semibold')}
              />
            </div>
            <button
              type="button"
              aria-label="Open calendar"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="bg-brand-25 border-neutral-150 flex size-10 shrink-0 items-center justify-center rounded-[10px] border md:size-[54px]"
            >
              <CalendarDays aria-hidden className="text-brand size-5" />
            </button>
          </div>
          {open && (
            <div className="absolute top-full right-0 left-0 z-10 mt-2 flex justify-center">
              <DatePicker
                value={value}
                min={min}
                max={max}
                onPick={(iso) => {
                  setMask(isoToMask(iso));
                  onChange(iso);
                  setOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <p className={cx('text-[15px] leading-6 md:text-[13px] md:leading-[21px]', showError ? 'text-danger' : 'text-neutral-650')}>
          {showError
            ? examDate
              ? `Pick a day from today up to ${formatPlanDate(max)}, so your plan finishes before the exam.`
              : "That date isn't valid. Pick a day from today onwards, within the next year."
            : value
              ? 'You can enter your target date or choose one from the calendar.'
              : examDate
                ? `Choose the date by which you want to finish the syllabus. Your exam is on ${formatPlanDate(examDate)}.`
                : 'Choose the date by which you want to complete the syllabus for the exam you are preparing for.'}
        </p>
      </div>
    </QuestionCard>
  );
}

function ErrorModal({ body, hint, retrying, onAdjust, onRetry }: { body: string; hint: string; retrying: boolean; onAdjust: () => void; onRetry: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="plan-error-title"
      className="flex justify-center pt-8 md:fixed md:inset-0 md:z-50 md:items-center md:bg-neutral-950/30 md:px-4 md:py-10 md:backdrop-blur-[6px]"
    >
      <div className="bg-surface border-neutral-150 flex w-full max-w-[436px] flex-col items-center gap-4 rounded-[28px] border-t px-6 pt-8 pb-10 shadow-lg md:gap-[14px] md:p-8">
        <span className="bg-danger-soft border-danger/10 flex size-20 items-center justify-center rounded-2xl border shadow-[0_0_0_7px_var(--color-brand-25)] md:size-[68px] md:rounded-xl">
          <AlertCircle aria-hidden className="text-danger size-[34px] md:size-7" strokeWidth={3} />
        </span>
        <h2 id="plan-error-title" className="text-center text-[24px] leading-8 font-bold text-neutral-900 md:text-[20px] md:leading-7">
          We couldn&apos;t build your Study plan
        </h2>
        <p className="text-center text-[16px] leading-[26px] text-neutral-900/70 md:text-[14px] md:leading-[22px]">{body}</p>
        <div className="bg-danger-soft border-danger flex w-full items-center gap-3 rounded-lg border p-4 md:gap-[10px] md:p-[14px]">
          <span className="bg-surface border-danger/20 flex size-8 shrink-0 items-center justify-center rounded-sm border md:size-7">
            <AlertCircle aria-hidden className="text-danger size-[14px]" />
          </span>
          <span className="text-danger min-w-0 flex-1 text-[14px] leading-[21px] font-medium md:text-[12px] md:leading-[18px]">{hint}</span>
        </div>
        <div className="flex w-full flex-col gap-3 pt-1 md:gap-[10px] md:pt-0">
          <button type="button" onClick={onAdjust} className="bg-brand text-on-brand h-14 w-full rounded-lg text-[16px] font-semibold hover:opacity-90 md:h-12 md:text-[14px]">
            Adjust plan criteria
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="bg-surface border-neutral-150 text-neutral-900 h-14 w-full rounded-lg border-2 text-[16px] font-semibold hover:enabled:bg-neutral-50 md:h-12 md:text-[14px]"
          >
            {retrying ? 'Trying…' : 'Try again'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Create your Personalised Study Plan": 3 questions, then POST /study-plan/create. */
export function CreatePlanScreen() {
  const router = useRouter();
  const { exam, classId, isPending } = useClassContext();
  const status = usePlanStatus(classId);
  const draft = useStudyPlanDraft();
  const moduleIds = draft.classId === classId ? draft.moduleIds : [];
  const [step, setStep] = useState(1);
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (status.data?.allowedPlanTypes.length === 1 && !planType) setPlanType(status.data.allowedPlanTypes[0]!);
  }, [status.data, planType]);

  const create = useMutation({
    mutationFn: () => studyPlanApi.create({ classId: classId!, planType: planType!, moduleIds, dailyMinutes: minutes, targetDate: targetDate! }),
    onSuccess: (result) => {
      if (result.feasible && exam) {
        draft.clear();
        router.replace(routes.studyPlan(exam.slug));
      } else setShowError(true);
    },
    onError: () => setShowError(true),
  });

  if (!isPending && !classId) return <Notice title="No active class" body="Pick a class from the sidebar to build a study plan." />;
  if (!exam || isPending) return <ScreenLoader message="Getting Ready" sub="Checking your diagnostic and plan status..." />;
  const chaptersHref = routes.studyPlanChapters(exam.slug);
  if (create.data?.feasible) return <ScreenLoader message="Opening Your Study Plan" sub="Pulling together your schedule..." />;
  if (!moduleIds.length)
    return <Notice title="No chapters selected" body="Choose the chapters your plan should cover first." action={{ label: 'Choose chapters', href: chaptersHref }} />;
  if (status.isPending) return <ScreenLoader message="Getting Ready" sub="Checking your diagnostic and plan status..." />;
  if (status.isError) return <Notice title="Couldn't start your plan" body="We couldn't check whether you can build a plan right now." action={{ label: 'Go back', href: chaptersHref }} />;
  if (!status.data.canCreate) {
    const blocked = BLOCKED[status.data.state];
    return (
      <Notice
        title={blocked?.title ?? "You can't build a plan yet"}
        body={blocked?.body ?? 'Take a diagnostic test to unlock your study plan.'}
        action={{ label: blocked?.action ?? 'Take the test', href: routes.diagnostic(exam.slug) }}
      />
    );
  }
  if (showError) {
    const verdict = create.data && !create.data.feasible ? create.data : { message: null, minPerDay: null };
    const copy = infeasibleCopy(verdict, minutes);
    return (
      <ErrorModal
        body={copy.body}
        hint={copy.hint}
        retrying={create.isPending}
        onAdjust={() => {
          setShowError(false);
          setStep(2);
        }}
        onRetry={() => create.mutate()}
      />
    );
  }

  const insight =
    step === 1
      ? {
          title: 'How your plan will change',
          body:
            status.data.allowedPlanTypes.length === 1
              ? 'From 1 January only Revise is available — your plan focuses on quick recall of what you have already been taught.'
              : 'Learn & Practice builds concepts first. From 1 January only Revise can be created.',
        }
      : step === 2 || !targetDate
        ? { title: 'Built around your daily time', body: "We'll create your plan based on the time you can study each day." }
        : { title: 'Your plan completion date', body: `Your study plan will be paced to help you complete the syllabus by ${formatPlanDate(targetDate)}.` };
  const disabled = (step === 1 && !planType) || (step === 3 && !targetDate) || create.isPending;
  const percent = Math.round((step / TOTAL_STEPS) * 100);
  const back = () => (step > 1 ? setStep(step - 1) : router.push(chaptersHref));
  const iconButton = 'bg-brand-125 text-brand flex size-10 items-center justify-center rounded-full shadow-[0px_8px_20px_rgba(61,52,139,0.06)] disabled:opacity-40';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="study-plan-wizard-title" className="bg-neutral-950/30 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-[6px] md:items-center md:p-5">
      <div className="bg-surface border-neutral-150 flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-t-[32px] border shadow-lg md:max-h-[calc(100dvh-40px)] md:max-w-[486px] md:rounded-2xl">
        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-6 pt-8 md:pt-6">
          <div className="flex items-center justify-between md:hidden">
            <button type="button" aria-label="Back" onClick={back} className={iconButton}>
              <ArrowLeft aria-hidden className="size-[18px]" />
            </button>
            <button type="button" aria-label="Close" onClick={() => router.push(chaptersHref)} className={iconButton}>
              <X aria-hidden className="size-[18px]" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-[6px] md:gap-[3px]">
            <span className="text-brand text-[12px] leading-4 font-semibold tracking-[0.45px] uppercase md:text-[11px]">Atlas AI</span>
            <h1 id="study-plan-wizard-title" className="text-center text-[18px] leading-[26px] font-bold text-neutral-900 md:text-[20px] md:leading-none">
              Create your Personalised Study Plan
            </h1>
            <p className="text-neutral-650 text-center text-[15px] leading-[22px] md:text-[13px] md:leading-5">Answer 3 quick questions. I&apos;ll create your study plan.</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-brand text-[12px] font-semibold tracking-[0.45px] uppercase md:text-[11px]">
                Question {step} of {TOTAL_STEPS}
              </span>
              <span className="text-[13px] font-medium text-neutral-900/60 md:text-[11px]">{percent}% complete</span>
            </div>
            <div className="bg-brand-125 h-[10px] w-full overflow-hidden rounded-full md:h-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="bg-brand h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {step === 1 && <PlanTypeStep value={planType} allowed={status.data.allowedPlanTypes} onChange={setPlanType} />}
          {step === 2 && <DailyMinutesStep value={minutes} onChange={setMinutes} />}
          {step === 3 && <TargetDateStep value={targetDate} onChange={setTargetDate} maxDate={status.data.maxTargetDate} examDate={status.data.examDate} />}
          <div className="bg-success-50 border-success-400 flex items-start gap-3 rounded-lg border p-4 md:gap-[10px] md:rounded-[14px] md:p-3">
            <span className="bg-surface border-success-100 flex size-8 shrink-0 items-center justify-center rounded-sm border md:size-auto md:border-0 md:bg-transparent">
              <Info aria-hidden className="text-success-400 size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-col gap-[3px] text-neutral-800">
              <span className="text-[15px] leading-[22px] font-bold md:text-[13px] md:leading-[19px]">{insight.title}</span>
              <span className="text-[13px] leading-[22px] font-medium md:text-[12px] md:leading-[18px]">{insight.body}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-6 pt-[14px] pb-8 md:pb-6">
          <button
            type="button"
            disabled={disabled}
            onClick={() => (step < TOTAL_STEPS ? setStep(step + 1) : create.mutate())}
            className={cx(
              'text-on-brand h-[52px] w-full rounded-xl text-[16px] font-semibold disabled:cursor-not-allowed md:h-11 md:rounded-lg md:text-[14px]',
              disabled ? 'bg-brand-300' : 'bg-brand shadow-[0px_8px_20px_rgba(61,52,139,0.12)] hover:opacity-90',
            )}
          >
            {create.isPending ? 'Working…' : step < TOTAL_STEPS ? 'Next' : 'Build my Plan'}
          </button>
          <button type="button" onClick={back} disabled={create.isPending} className="text-neutral-650 hidden text-[13px] font-semibold hover:opacity-70 disabled:opacity-40 md:block">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
