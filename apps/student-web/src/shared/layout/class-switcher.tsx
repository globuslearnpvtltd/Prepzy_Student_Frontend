'use client';

import { cx } from '@prepzy/design-system';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Crown, GraduationCap, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { planTier, useActivePlan, usePlans, usePlanSelection, type ActivePlan } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';

/** "CLASS 12 (PCB)" */
export const classLabel = (plan: Pick<ActivePlan, 'className' | 'streamName'>) =>
  `${plan.className}${plan.streamName ? ` (${plan.streamName})` : ''}`;

function useSwitchPlan(exam: ExamConfig) {
  const router = useRouter();
  const select = usePlanSelection((state) => state.select);
  return (plan: ActivePlan) => {
    if (plan.status !== 'active') return;
    select(plan.planId);
    router.push(routes.dashboard(exam.slug));
  };
}

function TierPill({ plan }: { plan: ActivePlan }) {
  const tier = planTier(plan);
  return (
    <span
      className={cx(
        'w-fit rounded-[10px] px-2 py-px text-[10px] font-semibold',
        tier === 'Basic' ? 'bg-accent-soft text-accent' : 'bg-brand-150 text-brand',
      )}
    >
      {tier}
    </span>
  );
}

/** Board sidebar: the current class, opening "MY PLANS" to switch class or add one. */
export function ClassSwitcher({ exam }: { exam: ExamConfig }) {
  const plans = usePlans(exam);
  const current = useActivePlan(exam);
  const switchPlan = useSwitchPlan(exam);
  const plan = current.data;
  const label = plan ? classLabel(plan) : 'Free User';

  if (!plan) {
    return (
      <div className="bg-brand-50 border-brand text-neutral-800 rounded-lg border-2 p-[13px] text-[16px] font-bold">
        {label}
      </div>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Class: ${label}. Switch class`}
        className="bg-brand-50 hover:bg-brand-75 border-brand text-neutral-800 flex w-full items-center justify-between gap-1 rounded-lg border-2 p-[13px] text-left text-[16px] font-bold data-[state=open]:[&>svg]:rotate-180"
      >
        {label}
        <ChevronDown aria-hidden className="size-5 transition-transform" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="border-neutral-200 bg-surface z-50 max-h-[300px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-xl border-2 shadow-lg"
        >
          <DropdownMenu.Label className="bg-canvas border-line border-b px-5 py-3 text-[12px] font-bold text-neutral-500">
            MY PLANS
          </DropdownMenu.Label>
          {(plans.data ?? []).map((item) => {
            const selected = item.planId === plan.planId;
            const active = item.status === 'active';
            return (
              <DropdownMenu.Item
                key={item.planId}
                disabled={!active}
                onSelect={() => switchPlan(item)}
                className="border-line data-[highlighted]:bg-brand-50 flex cursor-pointer flex-col gap-1 border-b px-5 py-4 outline-none data-[disabled]:cursor-default"
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      'text-[16px] leading-6 font-bold',
                      selected ? 'text-brand' : active ? 'text-foreground' : 'text-foreground-muted',
                    )}
                  >
                    {classLabel(item)}
                  </span>
                  {selected ? (
                    <Check aria-label="Current class" className="text-brand size-4" />
                  ) : (
                    !active && (
                      <span className="bg-danger-soft text-danger rounded-full px-3 py-1 text-[12px] font-medium">
                        {item.status}
                      </span>
                    )
                  )}
                </span>
                <TierPill plan={item} />
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Item asChild>
            <Link
              href={routes.plans(exam.slug)}
              className="text-brand data-[highlighted]:bg-brand-50 flex items-center justify-center gap-2 px-2.5 py-[18px] text-[16px] font-bold outline-none"
            >
              <Plus aria-hidden className="size-3" strokeWidth={4} />
              Add New Class
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Board mobile drawer: plan length and the class switcher on the purple profile card. */
export function DrawerClassSwitcher({ exam, onSwitched }: { exam: ExamConfig; onSwitched?: () => void }) {
  const plans = usePlans(exam);
  const current = useActivePlan(exam);
  const switchPlan = useSwitchPlan(exam);
  const [open, setOpen] = useState(false);
  const plan = current.data;
  if (!plan) return null;
  return (
    <>
      <div className="bg-surface/20 border-surface flex w-full items-center gap-2 rounded-md border p-2">
        <Crown aria-hidden className="text-accent-400 size-4" />
        <span className="text-on-brand text-[12px] font-semibold">{plan.durationMonths} Months Plan</span>
      </div>
      <div className="w-full">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="bg-surface/20 border-surface flex w-full items-center gap-2 rounded-md border p-2"
        >
          <GraduationCap aria-hidden className="text-success size-5" />
          <span className="text-on-brand flex-1 text-left text-[12px] font-semibold">
            {plan.className} {plan.streamName}
          </span>
          <ChevronDown aria-hidden className={cx('text-on-brand size-5 transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <ul className="bg-surface/20 mt-2.5 flex flex-col gap-2 rounded-b-md">
            {(plans.data ?? []).map((item) => (
              <li key={item.planId}>
                <button
                  type="button"
                  disabled={item.status !== 'active'}
                  aria-current={item.planId === plan.planId ? 'true' : undefined}
                  onClick={() => {
                    switchPlan(item);
                    setOpen(false);
                    onSwitched?.();
                  }}
                  className={cx(
                    'text-on-brand flex w-full items-center justify-between rounded-md p-2 text-[14px] font-medium disabled:opacity-60',
                    item.planId === plan.planId ? 'bg-accent-400' : 'hover:bg-surface/30',
                  )}
                >
                  <span>
                    {item.className} {item.streamName}
                  </span>
                  <span>{item.durationMonths} Month Plan</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
