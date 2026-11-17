'use client';

import { Alert, OptionGroup, OptionTile, Skeleton } from '@prepzy/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarCheck, Flag, Layers, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { examFromCatalog, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useExamCatalog } from '@/shared/hooks/use-exam-catalog';
import { userMessage } from '@/shared/lib/errors';
import { authApi } from '../api';
import { getDeviceFingerprint, rememberExam } from '../device';
import { authKeys } from '../hooks';
import type { PlanLengthOption } from '../model';
import { useOnboardingHydrated, useOnboardingStore } from '../onboarding-store';
import { ClassSetup } from './class-setup';
import { CHOICE_CARD, ChoiceDot, ContinueButton, OnboardingNotice, OnboardingStep } from './onboarding-step';

interface SetupChoice {
  classId: number;
  planLength?: number;
  withBundle?: boolean;
}

/**
 * Final sign-up step (the previous app's /setup). The backend decides what to ask per exam category
 * (GET …/onboarding-options): a class (board → ClassSetup, the previous CbseSetupComponent), or a target year from the
 * exam's plan lengths and then, when a combo exists, the plan scope (competitive → TargetYearSetup, the previous
 * NeetSetupComponent). Any exam of GET /api/v4/exams works without code changes.
 */
export function SetupForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { phone, examId, preselectedClassId, reset } = useOnboardingStore();
  const catalog = useExamCatalog();
  const exam = useMemo(() => (examId ? examFromCatalog(catalog.data, examId) : null), [catalog.data, examId]);
  const options = useQuery({
    queryKey: ['auth', 'onboarding-options', exam?.category, exam?.examId],
    queryFn: () => authApi.onboardingOptions(exam!),
    enabled: !!exam,
    staleTime: Infinity,
  });
  // Set once onboarding succeeds, so clearing the flow state doesn't trigger the restart below.
  const completed = useRef(false);

  const hydrated = useOnboardingHydrated();

  useEffect(() => {
    if (completed.current || !hydrated) return;
    if (!phone) router.replace(routes.getStarted());
    else if (catalog.isSuccess && !exam) router.replace(routes.examSelection());
  }, [hydrated, phone, exam, catalog.isSuccess, router]);

  const complete = useMutation({
    mutationFn: async ({ target, choice }: { target: ExamConfig; choice: SetupChoice }) => {
      const fingerprint = await getDeviceFingerprint();
      return authApi.completeOnboarding({
        phone: phone ?? '',
        examId: target.examId,
        classId: choice.classId,
        planLength: choice.planLength,
        withBundle: choice.withBundle,
        fingerprint,
      });
    },
    onSuccess: (student, { target }) => {
      completed.current = true;
      queryClient.setQueryData(authKeys.me, student);
      rememberExam(target.slug);
      // Welcome screen first (free Topper month, coupon / referral code), then the dashboard.
      router.replace(routes.welcome(target.slug));
      reset();
    },
  });

  if (!exam) return null;
  const submit = (choice: SetupChoice) => complete.mutate({ target: exam, choice });
  // Until the backend answers, the layout the exam's category expects.
  const byYear = options.data ? options.data.choose === 'target_year' : exam.onboarding.kind === 'choose-target-year';

  if (!byYear) {
    return (
      <ClassSetup
        exam={exam}
        preselected={preselectedClassId}
        submitting={complete.isPending}
        error={complete.error}
        onSubmit={(classId) => submit({ classId })}
      />
    );
  }
  return (
    <TargetYearSetup
      exam={exam}
      lengths={options.data?.choose === 'target_year' ? options.data.planLengths : null}
      loadError={options.isError ? options.error : null}
      submitting={complete.isPending}
      error={complete.error}
      onSubmit={submit}
    />
  );
}

/** Copy and icon of a preparation length (1 year, 2 years, 3 years …), as on the previous target-year cards. */
const LENGTH_HINT: Record<number, string> = {
  1: 'Class 12 now, or a dropper',
  2: 'Class 11 now',
  3: 'Class 10 or below',
};
const LENGTH_ICONS = [CalendarCheck, Flag, Trophy] as const;

type Scope = 'only' | 'bundle';

/**
 * Target-year setup (the previous NeetSetupComponent): step 4 "Which {exam} are you writing?" (one card per plan
 * length), then, when that length has a combo plan, step 5 "What are you preparing for?" ({exam} only / {exam} +
 * the bundled exams, "Most Chosen"). Without a combo the year step finishes sign-up.
 */
function TargetYearSetup({
  exam,
  lengths,
  loadError,
  submitting,
  error,
  onSubmit,
}: {
  exam: ExamConfig;
  lengths: PlanLengthOption[] | null;
  loadError: unknown;
  submitting: boolean;
  error: unknown;
  onSubmit: (choice: SetupChoice) => void;
}) {
  const [length, setLength] = useState('');
  const [scope, setScope] = useState<Scope | ''>('');
  const [onScope, setOnScope] = useState(false);
  const chosen = lengths?.find((l) => String(l.planLength) === length) ?? null;
  const year = new Date().getFullYear();

  const bundleNames = chosen?.bundleTitles.join(' + ') || 'the bundled exams';
  const bundleDetail =
    ('bundleDetail' in exam.onboarding ? exam.onboarding.bundleDetail : undefined) ??
    (chosen?.bundleTitles.join(' & ') || undefined);
  const scopes: { id: Scope; Icon: LucideIcon; title: string; subtitle?: string; note: string; badge?: string }[] = [
    {
      id: 'only',
      Icon: BookOpen,
      title: `${exam.label} only`,
      subtitle: exam.tagline,
      note: `You get Topper ${exam.label} Monthly free`,
    },
    {
      id: 'bundle',
      Icon: Layers,
      title: `${exam.label} + ${bundleNames}`,
      subtitle: bundleDetail ? `${exam.label} only + ${bundleDetail}` : undefined,
      note: `You get Topper ${exam.label} + ${bundleNames} Monthly free`,
      badge: 'Most Chosen',
    },
  ];

  const next = () => {
    if (!chosen) return;
    if (!onScope && chosen.hasBundle) {
      setOnScope(true);
      return;
    }
    onSubmit({
      classId: chosen.classId,
      planLength: chosen.planLength,
      withBundle: onScope ? scope === 'bundle' : false,
    });
  };

  const footer = (
    <ContinueButton disabled={onScope ? !scope : !chosen} loading={submitting} onClick={next}>
      {submitting ? 'Setting up…' : 'Continue'}
    </ContinueButton>
  );

  if (onScope) {
    return (
      <OnboardingStep
        step={5}
        onBack={() => setOnScope(false)}
        title="What are you preparing for?"
        subtitle="This decides which plan you get free for a month."
        footer={footer}
      >
        <OptionGroup
          aria-label="Plan"
          value={scope}
          onValueChange={(value) => setScope(value as Scope)}
          className="mx-auto grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4"
        >
          {scopes.map(({ id, ...option }) => (
            <ChoiceCard key={id} value={id} selected={scope === id} {...option} />
          ))}
        </OptionGroup>
        <OnboardingNotice>Both are free for your first month. You can switch later from your profile.</OnboardingNotice>
        <SubmitError error={error} />
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      step={4}
      backHref={routes.examSelection()}
      title={`Which ${exam.label} are you writing?`}
      subtitle="This sets how long your plan runs. You can change it later."
      footer={footer}
    >
      {loadError ? (
        <Alert tone="danger">{userMessage(loadError)}</Alert>
      ) : !lengths ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-[20px] lg:h-[200px]" />
          ))}
        </div>
      ) : lengths.length === 0 ? (
        <Alert tone="info">No plans are available for {exam.label} yet. Please choose another exam or check back soon.</Alert>
      ) : (
        <OptionGroup
          aria-label="Target year"
          value={length}
          onValueChange={setLength}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4"
        >
          {lengths.map((option, i) => (
            <ChoiceCard
              key={option.planLength}
              value={String(option.planLength)}
              title={`${exam.label} ${option.targetYear ?? year + option.planLength}`}
              subtitle={LENGTH_HINT[option.planLength]}
              Icon={LENGTH_ICONS[i % LENGTH_ICONS.length]!}
              selected={length === String(option.planLength)}
            />
          ))}
        </OptionGroup>
      )}
      <OnboardingNotice>
        Everyone gets the same free month. Your target only decides which full plan you see later.
      </OnboardingNotice>
      <SubmitError error={error} />
    </OnboardingStep>
  );
}

function SubmitError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert tone="danger" className="mt-4 text-left">
      {userMessage(error)}
    </Alert>
  );
}

/** The previous app's OptionCard: icon tile, title, caption, optional note and badge, radio dot. */
function ChoiceCard({
  value,
  title,
  subtitle,
  note,
  badge,
  Icon,
  selected,
}: {
  value: string;
  title: string;
  subtitle?: string;
  note?: string;
  badge?: string;
  Icon: LucideIcon;
  selected: boolean;
}) {
  const titleId = useId();
  const hintId = useId();
  return (
    <OptionTile
      value={value}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? hintId : undefined}
      className={`${CHOICE_CARD} relative overflow-visible rounded-[20px] p-4 lg:p-5 lg:pt-6 lg:pb-6`}
    >
      {badge && (
        <>
          <span className="bg-brand/10 text-brand absolute top-3 right-3 hidden rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.5px] lg:inline-flex">
            {badge}
          </span>
          <span className="bg-brand text-on-brand border-surface absolute -top-2 right-4 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.5px] lg:hidden">
            {badge}
          </span>
        </>
      )}
      <span className="flex items-center gap-4 text-left lg:flex-col lg:items-center lg:gap-0 lg:text-center">
        <span className="bg-brand-soft flex size-14 shrink-0 items-center justify-center rounded-2xl lg:mb-3">
          <Icon aria-hidden size={26} strokeWidth={2} className="text-brand" />
        </span>
        <span className="min-w-0 flex-1 lg:flex-none">
          <span id={titleId} className="text-ink block text-[16px] font-bold lg:text-[18px]">
            {title}
          </span>
          {subtitle && (
            <span id={hintId} className="text-foreground-subtle mt-0.5 block text-[12px] leading-[1.4] lg:mt-1">
              {subtitle}
            </span>
          )}
          {note && <span className="text-brand mt-1 block text-[12px] font-semibold lg:mt-2">{note}</span>}
        </span>
        <ChoiceDot selected={selected} className="lg:mt-4" />
      </span>
    </OptionTile>
  );
}
