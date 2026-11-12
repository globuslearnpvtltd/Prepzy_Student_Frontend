'use client';

import { Alert, OptionGroup, OptionTile, Skeleton } from '@prepzy/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronDown, Flag, Trophy } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { findExam, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint, rememberExam } from '../device';
import { authKeys } from '../hooks';
import type { PlanLengthOption } from '../model';
import type { ClassOption } from '../model';
import { useOnboardingHydrated, useOnboardingStore } from '../onboarding-store';
import { CHOICE_CARD, ChoiceDot, ContinueButton, OnboardingNotice, OnboardingStep } from './onboarding-step';

/**
 * Final sign-up step. The backend decides what to ask per exam category (GET …/onboarding-options):
 * a class (board), or a target year from the exam's plan lengths (competitive), optionally with its combo bundle.
 */
export function SetupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { phone, examId, preselectedClassId, reset } = useOnboardingStore();
  const catalog = useExamCatalog();
  const exam = useMemo(() => {
    const entry = catalog.data?.find((e) => e.examId === examId);
    const design = entry ? findExam(entry.examSlice) : null;
    return entry && design ? { ...design, examId: entry.examId } : null;
  }, [catalog.data, examId]);
  const options = useQuery({
    queryKey: ['auth', 'onboarding-options', exam?.category, exam?.examId],
    queryFn: () => authApi.onboardingOptions(exam!),
    enabled: !!exam,
    staleTime: Infinity,
  });
  const [choice, setChoice] = useState('');
  const [withBoard, setWithBoard] = useState(false);
  // Set once onboarding succeeds, so clearing the flow state doesn't trigger the restart below.
  const completed = useRef(false);

  const hydrated = useOnboardingHydrated();

  useEffect(() => {
    if (completed.current || !hydrated) return;
    if (!phone) router.replace(routes.getStarted());
    else if (catalog.isSuccess && !exam) router.replace(routes.examSelection());
  }, [hydrated, phone, exam, catalog.isSuccess, router]);

  const lengths = options.data?.choose === 'target_year' ? options.data.planLengths : null;
  const chosenLength = lengths?.find((l) => String(l.planLength) === choice) ?? null;
  const bundle = lengths?.find((l) => l.hasBundle) ?? null;

  const complete = useMutation({
    mutationFn: async (target: ExamConfig) => {
      const fingerprint = await getDeviceFingerprint();
      return authApi.completeOnboarding({
        phone: phone ?? '',
        examId: target.examId,
        classId: chosenLength ? chosenLength.classId : Number(choice),
        planLength: chosenLength?.planLength,
        withBundle: chosenLength ? withBoard && chosenLength.hasBundle : undefined,
        fingerprint,
      });
    },
    onSuccess: (student, target) => {
      completed.current = true;
      queryClient.setQueryData(authKeys.me, student);
      rememberExam(target.slug);
      // Welcome screen first (free Topper month, coupon / referral code), then the dashboard.
      router.replace(routes.welcome(target.slug));
      reset();
    },
  });

  if (!exam) return null;

  // The registry's wording when it has one, else the bundled exams' names from the plans.
  const bundleLabel = bundle
    ? (('boardAddOnLabel' in exam.onboarding ? exam.onboarding.boardAddOnLabel : undefined) ??
      `Also prepare for ${bundle.bundleTitles.join(' & ') || 'the bundled exams'}`)
    : null;
  // Copy follows what the backend asks for; until it answers, what the registry expects.
  const byYear = options.data ? lengths !== null : exam.onboarding.kind === 'choose-target-year';

  return (
    <OnboardingStep
      step={SETUP_STEP}
      backHref={routes.examSelection()}
      {...(byYear
        ? {
            title: `Which ${exam.label} are you writing?`,
            subtitle: 'This sets how long your plan runs. You can change it later.',
          }
        : {
            title: 'Which class are you in?',
            subtitle: 'Pick your class to get started.',
            mobileSubtitle: `You picked ${exam.label}. Pick your class to get started.`,
            layout: 'classes' as const,
          })}
      footer={
        <ContinueButton
          layout={byYear ? 'cards' : 'classes'}
          disabled={!choice}
          loading={complete.isPending}
          onClick={() => complete.mutate(exam)}
        >
          {complete.isPending ? 'Setting up…' : 'Continue'}
        </ContinueButton>
      }
    >
      {options.isPending ? (
        <ChoiceSkeleton />
      ) : options.isError ? (
        <Alert tone="danger">{userMessage(options.error)}</Alert>
      ) : lengths === null ? (
        <ClassChoice exam={exam} value={choice} onChange={setChoice} preselected={preselectedClassId} />
      ) : (
        <>
          <TargetYearChoice value={choice} onChange={setChoice} examLabel={exam.label} lengths={lengths} />
          {bundleLabel && (
            <label className="has-checked:border-brand has-checked:bg-brand-soft border-line bg-surface has-disabled:opacity-60 mx-auto mt-4 flex max-w-[720px] cursor-pointer items-center gap-4 rounded-[20px] border-2 p-6 text-left text-[14px] font-bold">
              <input
                type="checkbox"
                className="accent-brand size-5 shrink-0"
                checked={withBoard}
                disabled={!!chosenLength && !chosenLength.hasBundle}
                onChange={(e) => setWithBoard(e.target.checked)}
              />
              <span className="text-ink">{bundleLabel}</span>
            </label>
          )}
          <OnboardingNotice>
            Everyone gets the same free month. Your target only decides which full plan you see later.
          </OnboardingNotice>
        </>
      )}
      {complete.isError && (
        <Alert tone="danger" className="mt-4 text-left">
          {userMessage(complete.error)}
        </Alert>
      )}
    </OnboardingStep>
  );
}

const SETUP_STEP = 4;

function ChoiceSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[88px] w-full rounded-[20px] lg:h-[214px]" />
      ))}
    </div>
  );
}

/** Classes with the same title and several streams (e.g. Class 11 PCM / PCB) share one expandable card. */
function groupByTitle(classes: ClassOption[]): ClassOption[][] {
  const groups = new Map<string, ClassOption[]>();
  for (const c of classes) groups.set(c.title, [...(groups.get(c.title) ?? []), c]);
  return [...groups.values()];
}

const gradeOf = (title: string) => Number(/\d+/.exec(title)?.[0] ?? NaN);

/** The original's sections and card captions, by school grade (classes outside them are listed without a section). */
const GRADE_SECTIONS = [
  { label: 'Foundation', grades: [6, 7, 8], columns: 'lg:grid-cols-3' },
  { label: 'Secondary · Boards', grades: [9, 10], columns: 'lg:grid-cols-2' },
] as const;
const GRADE_CAPTION: Record<number, string> = {
  6: 'NCERT · practice · Atlas AI',
  7: 'NCERT · practice · Atlas AI',
  8: 'Foundation for 9 & 10',
  9: 'Concept-clear + practice',
  10: 'Board-ready · past papers',
};

const SECTION_LABEL = 'font-display text-onboarding-gold mb-2.5 text-left text-[12px] font-bold tracking-[1.5px] uppercase';

function ClassChoice({
  exam,
  value,
  onChange,
  preselected,
}: {
  exam: ExamConfig;
  value: string;
  onChange: (value: string) => void;
  preselected: number | null;
}) {
  const classes = useQuery({
    queryKey: ['auth', 'class-options', exam.examId],
    queryFn: () => authApi.classOptions(exam),
    staleTime: Infinity,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!value && preselected && classes.data?.some((c) => c.classId === preselected)) onChange(String(preselected));
  }, [classes.data, preselected, value, onChange]);

  if (classes.isPending) return <ChoiceSkeleton />;
  if (classes.isError) return <Alert tone="danger">{userMessage(classes.error)}</Alert>;

  const groups = groupByTitle(classes.data);
  const singles = groups.filter((g) => g.length === 1).map((g) => g[0]!);
  const streamed = groups.filter((g) => g.length > 1);
  const sections = GRADE_SECTIONS.map((section) => ({
    ...section,
    classes: singles.filter((c) => (section.grades as readonly number[]).includes(gradeOf(c.title))),
  })).filter((section) => section.classes.length > 0);
  const others = singles.filter((c) => !sections.some((section) => section.classes.includes(c)));

  return (
    <OptionGroup aria-label="Your class" value={value} onValueChange={onChange} className="flex flex-col gap-4 text-left">
      {sections.map((section) => (
        <div key={section.label}>
          <p className={SECTION_LABEL}>{section.label}</p>
          <div className={`grid grid-cols-1 gap-4 ${section.columns}`}>
            {section.classes.map((c) => (
              <ClassCard key={c.classId} option={c} />
            ))}
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {others.map((c) => (
            <ClassCard key={c.classId} option={c} />
          ))}
        </div>
      )}
      {streamed.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Senior · Choose stream</p>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {streamed.map((group) => {
              const title = group[0]!.title;
              const chosen = group.find((c) => String(c.classId) === value);
              return (
                <StreamCard
                  key={title}
                  title={title}
                  streams={group}
                  chosen={chosen ?? null}
                  open={expanded === title || !!chosen}
                  onToggle={() => setExpanded((open) => (open === title ? null : title))}
                />
              );
            })}
          </div>
        </div>
      )}
    </OptionGroup>
  );
}

const CLASS_TITLE = 'font-display text-onboarding-ink block text-[17px] font-extrabold lg:text-[19px]';
const CLASS_SUBTITLE = 'text-foreground-subtle mt-1 block text-[12px] font-medium lg:text-[13px]';

function ClassCard({ option }: { option: ClassOption }) {
  const titleId = useId();
  return (
    <OptionTile
      value={String(option.classId)}
      aria-labelledby={titleId}
      className={`${CHOICE_CARD} rounded-[18px] p-4`}
    >
      <span id={titleId} className={CLASS_TITLE}>
        {option.title}
      </span>
      {(option.streamName || GRADE_CAPTION[gradeOf(option.title)]) && (
        <span className={CLASS_SUBTITLE}>{option.streamName || GRADE_CAPTION[gradeOf(option.title)]}</span>
      )}
    </OptionTile>
  );
}

function StreamCard({
  title,
  streams,
  chosen,
  open,
  onToggle,
}: {
  title: string;
  streams: ClassOption[];
  chosen: ClassOption | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[18px] border-2 transition-all ${
        chosen ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span>
          <span className={CLASS_TITLE}>{title}</span>
          <span className={CLASS_SUBTITLE}>{chosen ? chosen.streamName : 'Pick your stream next'}</span>
          <span className="mt-1.5 flex items-center gap-1.5">
            <span className="bg-onboarding-gold size-1 rounded-full" />
            <span className="text-onboarding-gold text-[10px] font-bold tracking-[0.5px] uppercase">
              {streams.length} streams inside
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden
          size={18}
          className={`text-foreground-subtle shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 px-6 pb-6">
          {streams.map((c) => (
            <OptionTile
              key={c.classId}
              value={String(c.classId)}
              className="data-[state=checked]:border-brand data-[state=checked]:text-brand data-[state=unchecked]:border-line data-[state=unchecked]:text-ink data-[state=unchecked]:hover:border-brand/40 bg-surface hover:bg-surface rounded-md border-2 p-4 text-[13px] font-bold"
            >
              {c.streamName || title}
            </OptionTile>
          ))}
        </div>
      )}
    </div>
  );
}

/** Copy and icon of a preparation length (1 year, 2 years, 3 years …), as on the original target-year cards. */
const LENGTH_HINT: Record<number, string> = {
  1: 'Class 12 now, or a dropper',
  2: 'Class 11 now',
  3: 'Class 10 or below',
};
const LENGTH_ICONS = [CalendarCheck, Flag, Trophy] as const;

function TargetYearChoice({
  value,
  onChange,
  examLabel,
  lengths,
}: {
  value: string;
  onChange: (value: string) => void;
  examLabel: string;
  lengths: PlanLengthOption[];
}) {
  const year = new Date().getFullYear();
  return (
    <OptionGroup
      aria-label="Target year"
      value={value}
      onValueChange={onChange}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {lengths.map((length, i) => (
        <TargetYearCard
          key={length.planLength}
          value={String(length.planLength)}
          title={`${examLabel} ${length.targetYear ?? year + length.planLength}`}
          hint={LENGTH_HINT[length.planLength]}
          Icon={LENGTH_ICONS[i % LENGTH_ICONS.length]!}
          selected={value === String(length.planLength)}
        />
      ))}
    </OptionGroup>
  );
}

function TargetYearCard({
  value,
  title,
  hint,
  Icon,
  selected,
}: {
  value: string;
  title: string;
  hint?: string;
  Icon: (typeof LENGTH_ICONS)[number];
  selected: boolean;
}) {
  const titleId = useId();
  const hintId = useId();
  return (
    <OptionTile
      value={value}
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      className={`${CHOICE_CARD} rounded-[20px] p-6`}
    >
      <span className="flex items-center gap-6 text-left lg:flex-col lg:items-center lg:text-center">
        <span className="bg-brand-soft flex size-14 shrink-0 items-center justify-center rounded-lg lg:mb-3">
          <Icon aria-hidden size={26} strokeWidth={2} className="text-brand" />
        </span>
        <span className="min-w-0 flex-1 lg:flex-none">
          <span id={titleId} className="text-ink block text-[16px] font-bold lg:text-[18px]">
            {title}
          </span>
          {hint && (
            <span id={hintId} className="text-foreground-subtle mt-0.5 block text-[12px] leading-[1.4] lg:mt-1">
              {hint}
            </span>
          )}
        </span>
        <ChoiceDot selected={selected} className="lg:mt-4" />
      </span>
    </OptionTile>
  );
}
