'use client';

import { cx, Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@prepzy/design-system';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQueries } from '@tanstack/react-query';
import { BookOpen, Check, ChevronDown, Plus, Stethoscope, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  authApi,
  authKeys,
  pickActivePlan,
  planTier,
  usePlanSelection,
  usePurchasedExams,
  type ActivePlan,
} from '@/features/auth';
import { classLabel } from '@/features/plans';
import { findExam, REFERENCE, type ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';

export interface OwnedExam {
  exam: ExamConfig;
  /** Name from the backend ("NEET-UG"). */
  name: string;
}

/** The student's purchased exams that this app knows, in backend order. */
export function useOwnedExams(): OwnedExam[] {
  const purchased = usePurchasedExams();
  return (purchased.data ?? []).flatMap((p) => {
    const exam = findExam(p.examSlice);
    return exam ? [{ exam: { ...exam, examId: p.examId }, name: p.name || exam.label }] : [];
  });
}

/** One goal: an exam the student owns and one of its plans (classes). `plan` is null when the exam has none. */
export interface Goal {
  key: string;
  exam: ExamConfig;
  plan: ActivePlan | null;
  title: string;
  subtitle: string;
  current: boolean;
  /** Expired / cancelled plans are listed but can't be switched to. */
  disabled: boolean;
}

export interface GoalGroup {
  exam: ExamConfig;
  name: string;
  goals: Goal[];
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** "Topper plan · Valid till 30 Apr 2027"; free plans: "Free plan". */
export function goalSubtitle(plan: ActivePlan): string {
  if (plan.durationMonths === 0) return 'Free plan';
  const tier = `${planTier(plan)} plan`;
  const valid = plan.expiryDate && !Number.isNaN(new Date(plan.expiryDate).getTime());
  return valid ? `${tier} · Valid till ${formatDate(plan.expiryDate!)}` : tier;
}

/**
 * Every goal of the student: each owned exam with its plans (one query per exam, shared with usePlans), the current
 * exam's selected class marked current. Also the label of the header pill ("CBSE · Class 8").
 */
export function useGoals(current: ExamConfig | null) {
  const owned = useOwnedExams();
  const selectedId = usePlanSelection((state) => state.planId);
  const results = useQueries({
    queries: owned.map(({ exam }) => ({
      queryKey: authKeys.plans(exam.examId),
      queryFn: () => authApi.activePlans(exam.examId),
      staleTime: 5 * 60_000,
    })),
  });

  let currentPlan: ActivePlan | null = null;
  const groups: GoalGroup[] = owned.map(({ exam, name }, i) => {
    const plans = results[i]?.data ?? [];
    const isCurrentExam = exam.slug === current?.slug;
    const active = pickActivePlan(plans, selectedId);
    if (isCurrentExam) currentPlan = active;
    const goals: Goal[] = plans.length
      ? plans.map((plan) => ({
          key: `${exam.slug}-${plan.planId}`,
          exam,
          plan,
          title: classLabel(plan.className, plan.streamName),
          subtitle: plan.status === 'active' ? goalSubtitle(plan) : `${goalSubtitle(plan)} · ${plan.status}`,
          current: isCurrentExam && plan.planId === active?.planId,
          disabled: plan.status !== 'active',
        }))
      : [{ key: exam.slug, exam, plan: null, title: name, subtitle: 'No plan yet', current: isCurrentExam, disabled: false }];
    return { exam, name, goals };
  });

  const examName = owned.find((o) => o.exam.slug === current?.slug)?.name ?? current?.label ?? REFERENCE.label;
  const plan = currentPlan as ActivePlan | null;
  const label = current && plan ? `${examName} · ${classLabel(plan.className, plan.streamName)}` : examName;
  // Pages without an exam (reference books) manage plans of the student's first exam.
  const home = current ?? owned[0]?.exam ?? null;
  return { groups, label, home, hasGoals: owned.length > 0 };
}

/** Switches to a goal: picks its class (active plans only) and opens that exam's dashboard. */
export function useSwitchGoal() {
  const router = useRouter();
  const select = usePlanSelection((state) => state.select);
  return (goal: Goal) => {
    if (goal.current || goal.disabled) return;
    if (goal.plan) select(goal.plan.planId);
    router.push(routes.dashboard(goal.exam.slug));
  };
}

/** Book for board exams, stethoscope for competitive ones. */
export function ExamIcon({ exam, current = false }: { exam: ExamConfig; current?: boolean }) {
  const Icon = exam.category === 'competitive' ? Stethoscope : BookOpen;
  return (
    <span
      className={cx(
        'text-brand flex size-10 shrink-0 items-center justify-center rounded-[10px] border',
        current ? 'border-brand-150 bg-surface' : 'border-transparent bg-brand-75',
      )}
    >
      <Icon aria-hidden className="size-5" />
    </span>
  );
}

function GoalRowBody({ goal }: { goal: Goal }) {
  return (
    <>
      <ExamIcon exam={goal.exam} current={goal.current} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cx('truncate text-[15px] leading-5 font-semibold', goal.current ? 'text-brand' : 'text-ink')}>
          {goal.title}
        </span>
        <span className="text-foreground-muted truncate text-[12px] leading-[18px]">{goal.subtitle}</span>
      </span>
      {goal.current ? (
        <span aria-hidden className="bg-brand text-on-brand flex size-5 shrink-0 items-center justify-center rounded-full">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : (
        !goal.disabled && (
          <span
            aria-hidden
            className="text-brand hidden shrink-0 text-[13px] font-semibold group-hover/goal:inline group-focus-visible/goal:inline group-data-[highlighted]/goal:inline"
          >
            Switch
          </span>
        )
      )}
    </>
  );
}

const rowClass = (goal: Goal) =>
  cx(
    'group/goal flex w-full items-center gap-3 rounded-xl px-3 text-left outline-none',
    goal.current
      ? 'bg-brand-50'
      : goal.disabled
        ? 'cursor-default opacity-60'
        : 'hover:bg-canvas focus-visible:bg-canvas data-[highlighted]:bg-canvas cursor-pointer',
  );

const groupHeading = 'text-foreground-muted block px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide uppercase';

const goalName = (goal: Goal, examName: string) =>
  `${examName} ${goal.title}, ${goal.subtitle}${goal.current ? ', current goal' : ''}`;

function Pill({ label, open, compact = false, ...props }: { label: string; open: boolean; compact?: boolean } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={`My goals: ${label}`}
      aria-expanded={open}
      className={cx(
        'border-brand bg-brand-75 text-brand hover:bg-brand-100 flex min-w-0 items-center gap-1.5 rounded-full border-[1.5px] font-semibold whitespace-nowrap transition-colors',
        compact ? 'h-9 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
      )}
      {...props}
    >
      <span className="truncate">{label}</span>
      <ChevronDown aria-hidden className={cx('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

/** Desktop: the "{Exam} · {Class}" pill opening the "My goals" dropdown. */
export function GoalMenu({ exam }: { exam: ExamConfig | null }) {
  const { groups, label, home, hasGoals } = useGoals(exam);
  const switchGoal = useSwitchGoal();
  const [open, setOpen] = useState(false);
  if (!hasGoals) return null;
  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Pill label={label} open={open} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={10}
          className="border-line bg-surface z-[60] flex max-h-[min(560px,calc(100dvh-96px))] w-[404px] flex-col overflow-hidden rounded-2xl border shadow-lg"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <span className="text-ink text-[16px] font-semibold">My goals</span>
            {home && (
              <DropdownMenu.Item asChild>
                <Link
                  href={routes.plans(home.slug)}
                  className="text-brand rounded-md text-[13px] font-semibold outline-none hover:underline data-[highlighted]:underline"
                >
                  Manage plans
                </Link>
              </DropdownMenu.Item>
            )}
          </div>
          <div className="min-h-0 overflow-y-auto px-3 pb-2">
            {groups.map((group) => (
              <DropdownMenu.Group key={group.exam.slug} aria-label={group.name}>
                <DropdownMenu.Label className={groupHeading}>{group.name}</DropdownMenu.Label>
                <div className="flex flex-col gap-1">
                  {group.goals.map((goal) => (
                    <DropdownMenu.Item
                      key={goal.key}
                      disabled={goal.disabled}
                      aria-current={goal.current ? 'true' : undefined}
                      aria-label={goalName(goal, group.name)}
                      onSelect={() => switchGoal(goal)}
                      className={cx(rowClass(goal), 'min-h-14 py-2.5')}
                    >
                      <GoalRowBody goal={goal} />
                    </DropdownMenu.Item>
                  ))}
                </div>
              </DropdownMenu.Group>
            ))}
          </div>
          {home && (
            <div className="border-line border-t px-3 py-2">
              <DropdownMenu.Item asChild>
                <Link
                  href={routes.plansPurchase(home.slug)}
                  className="text-brand data-[highlighted]:bg-canvas flex h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold outline-none"
                >
                  <Plus aria-hidden className="size-5" />
                  Add another goal
                </Link>
              </DropdownMenu.Item>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Mobile: the compact pill opening the "My goals" bottom sheet (same rows, 64px tall). */
export function GoalSheet({ exam }: { exam: ExamConfig | null }) {
  const { groups, label, home, hasGoals } = useGoals(exam);
  const switchGoal = useSwitchGoal();
  const [open, setOpen] = useState(false);
  if (!hasGoals) return null;
  const close = () => setOpen(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Pill label={label} open={open} compact />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="top-auto bottom-0 left-0 flex max-h-[85dvh] w-full max-w-none transform-none flex-col gap-0 rounded-none rounded-t-[24px] p-0 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex justify-center pt-2.5" aria-hidden="true">
          <span className="bg-brand-150 h-1 w-9 rounded-full" />
        </div>
        <div className="border-line flex items-center justify-between gap-3 border-b px-5 pt-3 pb-3">
          <DialogTitle className="text-ink text-[17px] leading-6 font-semibold">My goals</DialogTitle>
          <div className="flex items-center gap-3">
            {home && (
              <Link href={routes.plans(home.slug)} onClick={close} className="text-brand px-1 py-2.5 text-[14px] font-semibold">
                Manage plans
              </Link>
            )}
            <DialogClose
              aria-label="Close"
              className="text-ink hover:bg-canvas flex size-11 items-center justify-center rounded-full"
            >
              <X aria-hidden className="size-5" />
            </DialogClose>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {groups.map((group) => (
            <section key={group.exam.slug} aria-label={group.name}>
              <h3 className={groupHeading}>{group.name}</h3>
              <ul className="flex flex-col gap-1">
                {group.goals.map((goal) => (
                  <li key={goal.key}>
                    <button
                      type="button"
                      disabled={goal.disabled}
                      aria-current={goal.current ? 'true' : undefined}
                      aria-label={goalName(goal, group.name)}
                      onClick={() => {
                        close();
                        switchGoal(goal);
                      }}
                      className={cx(rowClass(goal), 'h-16')}
                    >
                      <GoalRowBody goal={goal} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {home && (
          <div className="border-line border-t px-4 py-2">
            <Link
              href={routes.plansPurchase(home.slug)}
              onClick={close}
              className="text-brand hover:bg-canvas flex h-14 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold"
            >
              <Plus aria-hidden className="size-5" />
              Add another goal
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
