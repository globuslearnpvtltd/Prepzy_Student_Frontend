'use client';

import { cx } from '@prepzy/design-system';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAtlas } from '@/features/assistant';
import { planTier, useActivePlan, type ActivePlan } from '@/features/auth';
import type { ExamConfig } from '@/shared/config/exams';
import { isActivePath, isNavLocked, navigationFor, type NavAccess, type NavItem } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { useHasStudyPlan } from './shell-api';

/** What the student can open: Learn / Assessments / Notes need a plan, Study Plan needs a built study plan. */
export function useNavAccess(exam: ExamConfig): NavAccess {
  const plan = useActivePlan(exam);
  const studyPlan = useHasStudyPlan(plan.data?.classId ?? null);
  return { hasPlan: !!plan.data, hasStudyPlan: !!studyPlan.data };
}

/** "CLASS 12 (PCB)" */
const classLabel = (plan: Pick<ActivePlan, 'className' | 'streamName'>) =>
  `${plan.className}${plan.streamName ? ` (${plan.streamName})` : ''}`;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

function NavRow({ item, exam, active, locked }: { item: NavItem; exam: ExamConfig; active: boolean; locked: boolean }) {
  const content = (
    <>
      <span className="flex items-center gap-2.5">
        <item.icon aria-hidden className="size-6" />
        {item.label}
      </span>
      {locked && (
        <span className="bg-surface text-brand flex size-6 items-center justify-center rounded-[6px]">
          <Lock aria-label="Locked" className="size-3.5" />
        </span>
      )}
    </>
  );
  const base = 'flex items-center justify-between gap-4 rounded-lg p-4 text-[16px] font-medium transition-colors';
  if (locked) {
    return (
      <span aria-disabled="true" className={cx(base, 'bg-canvas text-foreground-muted cursor-not-allowed opacity-70')}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={item.href(exam.slug)}
      aria-current={active ? 'page' : undefined}
      className={cx(
        base,
        active ? 'bg-brand text-on-brand' : 'bg-canvas text-foreground-muted hover:bg-brand-100 hover:text-foreground-muted',
      )}
    >
      {content}
    </Link>
  );
}

function ActivePlanCard({ exam }: { exam: ExamConfig }) {
  const plan = useActivePlan(exam).data;
  return (
    <Link
      href={routes.plans(exam.slug)}
      aria-label={plan ? `Active plan: ${classLabel(plan)} ${planTier(plan)}. Manage` : 'Free User. Manage plan'}
      className="bg-brand-75 flex flex-col gap-0.5 rounded-xl px-[18px] py-4"
    >
      <span className="text-brand text-[11px] leading-4 font-semibold tracking-[1px] uppercase">Active plan</span>
      {plan ? (
        <>
          <span className="text-ink text-[14px] leading-[22px] font-bold">
            {classLabel(plan)} · {planTier(plan)}
          </span>
          <span className="flex items-center justify-between gap-2">
            {plan.durationMonths !== 0 && plan.expiryDate ? (
              <span className="text-foreground-muted text-[12px] leading-[18px]">Expires {formatDate(plan.expiryDate)}</span>
            ) : (
              <span />
            )}
            <span className="text-brand decoration-brand/40 shrink-0 text-[12px] leading-[18px] font-semibold underline underline-offset-[3px]">
              Manage
            </span>
          </span>
        </>
      ) : (
        <span className="text-ink text-[14px] leading-[22px] font-bold">Free User</span>
      )}
    </Link>
  );
}

/** Board desktop sidebar (240px): labelled navigation with locks, active plan card (classes switch from the header's goals pill). */
export function BoardSidebar({ exam }: { exam: ExamConfig }) {
  const pathname = usePathname();
  const access = useNavAccess(exam);
  return (
    <aside className="border-line bg-surface shadow-header fixed top-[76px] left-0 z-30 hidden h-[calc(100dvh-76px)] w-60 flex-col gap-[38px] overflow-y-auto border-t border-r px-3 py-5 md:flex">
      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-2">
          {navigationFor(exam).map((item) => (
            <li key={item.key}>
              <NavRow
                item={item}
                exam={exam}
                active={isActivePath(item.href(exam.slug), pathname)}
                locked={isNavLocked(item, access)}
              />
            </li>
          ))}
        </ul>
      </nav>
      <ActivePlanCard exam={exam} />
    </aside>
  );
}

function AskIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="18" rx="5.76" className="fill-surface" />
      <path d="M5.28 17.5h7l-6 6-1-6Z" className="fill-surface" />
      <path d="M12 3.5c.66 4.84.66 4.84 5.5 5.5-4.84.66-4.84.66-5.5 5.5-.66-4.84-.66-4.84-5.5-5.5 4.84-.66 4.84-.66 5.5-5.5Z" className="fill-brand" />
    </svg>
  );
}

/** Board mobile bottom bar: four sections with the raised "Ask" button in the middle. */
export function BoardBottomBar({ exam }: { exam: ExamConfig }) {
  const pathname = usePathname();
  const access = useNavAccess(exam);
  const items = navigationFor(exam).filter((item) => item.mobile);
  const half = Math.ceil(items.length / 2);

  const tab = (item: NavItem) => {
    const locked = isNavLocked(item, access);
    const active = isActivePath(item.href(exam.slug), pathname);
    const body = (
      <>
        <span className="relative">
          <item.icon aria-hidden className="size-[22px]" />
          {locked && (
            <span className="bg-surface text-brand absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm">
              <Lock aria-label="Locked" className="size-3" />
            </span>
          )}
        </span>
        <span className="mt-2 text-[10px] leading-[14px] font-semibold">{item.label}</span>
      </>
    );
    const className = cx('flex flex-col items-center', active ? 'text-brand-600' : 'text-neutral-600');
    return (
      <li key={item.key}>
        {locked ? (
          <span aria-disabled="true" className={cx(className, 'cursor-not-allowed opacity-60')}>
            {body}
          </span>
        ) : (
          <Link href={item.href(exam.slug)} aria-current={active ? 'page' : undefined} className={className}>
            {body}
          </Link>
        )}
      </li>
    );
  };

  return (
    <nav aria-label="Main" className="bg-surface shadow-bar-up fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex justify-around py-1.5">
        {items.slice(0, half).map(tab)}
        <li className="flex flex-col items-center">
          {/* Opens the Atlas vs Socrates sheet (features/assistant AtlasHost). */}
          <button
            type="button"
            onClick={() => useAtlas.getState().setAskSheet(!useAtlas.getState().askSheet)}
            aria-label="Ask a question"
            className="border-surface from-brand-450 to-brand shadow-raised -mt-[30px] flex size-[52px] items-center justify-center rounded-full border-4 bg-linear-to-b"
          >
            <AskIcon />
          </button>
          <span className="mt-2 text-[10px] leading-[14px] font-semibold text-neutral-600" aria-hidden="true">
            Ask
          </span>
        </li>
        {items.slice(half).map(tab)}
      </ul>
    </nav>
  );
}
