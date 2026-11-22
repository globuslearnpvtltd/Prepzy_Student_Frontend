'use client';

import { cx } from '@prepzy/design-system';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAtlas } from '@/features/assistant';
import { planTier, useActivePlan, type ActivePlan } from '@/features/auth';
import { featureList, RESTRICTED_COPY, showFeatureRestricted, useFeatureAccess } from '@/features/feature-access';
import type { ExamConfig } from '@/shared/config/exams';
import {
  isActivePath,
  isNavLocked,
  navigationFor,
  type NavAccess,
  type NavItem,
  type NavLockReason,
} from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { useHasStudyPlan } from './shell-api';

/**
 * What the student can open: Learn / Assessments / Notes need a plan, Study Plan needs a built study plan, and nothing
 * the student's institute switched off (empty while the access list loads, so no lock flashes).
 */
export function useNavAccess(exam: ExamConfig): NavAccess {
  const plan = useActivePlan(exam);
  const studyPlan = useHasStudyPlan(plan.data?.classId ?? null);
  const { restricted } = useFeatureAccess(exam);
  return { hasPlan: !!plan.data, hasStudyPlan: !!studyPlan.data, restricted };
}

/** A locked item's padlock label: the institute's lock has its own tooltip. */
export const lockLabel = (reason: NavLockReason | false) => (reason === 'institute' ? RESTRICTED_COPY.tooltip : 'Locked');

/** Clicking an item the institute switched off explains why (other locks stay silent, as before). */
export function lockedClick(item: Pick<NavItem, 'feature'>, reason: NavLockReason | false) {
  return reason === 'institute' && item.feature ? () => showFeatureRestricted(featureList(item.feature!)[0] ?? null) : undefined;
}

/** "CLASS 12 (PCB)" */
const classLabel = (plan: Pick<ActivePlan, 'className' | 'streamName'>) =>
  `${plan.className}${plan.streamName ? ` (${plan.streamName})` : ''}`;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

function NavRow({
  item,
  exam,
  active,
  locked,
}: {
  item: NavItem;
  exam: ExamConfig;
  active: boolean;
  locked: NavLockReason | false;
}) {
  const content = (
    <>
      <span className="flex items-center gap-2.5">
        <item.icon aria-hidden className="size-6" />
        {item.label}
      </span>
      {locked && (
        <span title={lockLabel(locked)} className="bg-surface text-brand flex size-6 items-center justify-center rounded-[6px]">
          <Lock aria-label={lockLabel(locked)} className="size-3.5" />
        </span>
      )}
    </>
  );
  const base = 'flex items-center justify-between gap-4 rounded-lg p-4 text-[16px] font-medium transition-colors';
  if (locked === 'institute') {
    return (
      <button
        type="button"
        aria-disabled="true"
        title={RESTRICTED_COPY.tooltip}
        onClick={lockedClick(item, locked)}
        className={cx(base, 'bg-canvas text-foreground-muted w-full cursor-not-allowed text-left opacity-70')}
      >
        {content}
      </button>
    );
  }
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
      href={routes.managePlans()}
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
  // "Ask" leads to Atlas and Socrates: locked when the institute switched both off.
  const askLocked = useFeatureAccess(exam).isRestricted(['atlas_chat', 'doubt_solver']);
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
            <span title={lockLabel(locked)} className="bg-surface text-brand absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm">
              <Lock aria-label={lockLabel(locked)} className="size-3" />
            </span>
          )}
        </span>
        <span className="mt-2 text-[10px] leading-[14px] font-semibold">{item.label}</span>
      </>
    );
    const className = cx('flex flex-col items-center', active ? 'text-brand-600' : 'text-neutral-600');
    return (
      <li key={item.key}>
        {locked === 'institute' ? (
          <button
            type="button"
            aria-disabled="true"
            title={RESTRICTED_COPY.tooltip}
            onClick={lockedClick(item, locked)}
            className={cx(className, 'w-full cursor-not-allowed opacity-60')}
          >
            {body}
          </button>
        ) : locked ? (
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
            onClick={() =>
              askLocked ? showFeatureRestricted('atlas_chat') : useAtlas.getState().setAskSheet(!useAtlas.getState().askSheet)
            }
            aria-label="Ask a question"
            aria-disabled={askLocked || undefined}
            title={askLocked ? RESTRICTED_COPY.tooltip : undefined}
            className={cx(
              'border-surface from-brand-450 to-brand shadow-raised relative -mt-[30px] flex size-[52px] items-center justify-center rounded-full border-4 bg-linear-to-b',
              askLocked && 'cursor-not-allowed opacity-60',
            )}
          >
            <AskIcon />
            {askLocked && (
              <span className="bg-surface text-brand absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm">
                <Lock aria-label={RESTRICTED_COPY.tooltip} className="size-3" />
              </span>
            )}
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
