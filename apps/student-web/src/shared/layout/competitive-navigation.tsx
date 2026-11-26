'use client';

import { cx } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Lock, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { useFeatureAccess } from '@/features/feature-access';
import { useActivePlanName } from '@/features/plans';
import type { ExamConfig } from '@/shared/config/exams';
import { isActivePath, isNavLocked, navigationFor, type NavItem } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { lockedClick, lockLabel } from './board-navigation';
import { useMobileNav } from './mobile-nav-store';
import { shellApi, shellKeys } from './shell-api';

/**
 * Where "Daily Practice" goes, like the previous app: today's live paper (its result once submitted),
 * else the latest month's first paper, else the Daily Practice page.
 */
export async function resolveDailyPractice(exam: ExamConfig, fetchLive = () => shellApi.liveDpp(exam)): Promise<string> {
  try {
    const live = await fetchLive();
    if (live?.attempt?.status === 'submitted') return routes.testResult(exam.slug, 'dpp', live.attempt.attemptId);
    if (live) return routes.testPlayer(exam.slug, 'dpp', live.dppId);
    const latest = await shellApi.latestDppId(exam);
    if (latest) return routes.testPlayer(exam.slug, 'dpp', latest);
  } catch {
    // Fall through to the section page, which explains what's available.
  }
  return routes.dailyPractice(exam.slug);
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Share of the plan still left (bar in the expanded plan card). */
export function remainingPercent(expiryDate: string, durationMonths: number, now = Date.now()): number {
  const end = new Date(expiryDate);
  const start = new Date(end);
  start.setMonth(start.getMonth() - durationMonths);
  const total = end.getTime() - start.getTime();
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, ((end.getTime() - now) / total) * 100));
}

/**
 * NEET sidebar icons from the Figma design (public/icons/neet-sidebar), by nav item key. They're drawn as CSS masks
 * so the active / inactive colour comes from `currentColor`. Items without a design icon keep their own.
 */
// const DESIGN_ICONS: Partial<Record<string, string>> = {
//   dashboard: '/icons/neet-sidebar/dashboard.svg',
//   notes: '/icons/neet-sidebar/notes.svg',
//   'daily-practice': '/icons/neet-sidebar/daily-practice.svg',
//   'mock-tests': '/icons/neet-sidebar/mock-tests.svg',
//   'pyq-library': '/icons/neet-sidebar/pyq-library.svg',
//   'custom-exam': '/icons/neet-sidebar/custom-exam.svg',
// };

// function NavIcon({ nav, active }: { nav: NavItem; active: boolean }) {
//   const color = active ? 'text-brand' : 'text-rail-icon';
//   const src = DESIGN_ICONS[nav.key];
//   if (!src) return <nav.icon aria-hidden className={cx('size-7 shrink-0', color)} strokeWidth={2} />;
//   const mask = `url(${src}) center / contain no-repeat`;
//   return <span aria-hidden className={cx('size-6 shrink-0 bg-current', color)} style={{ mask, WebkitMask: mask }} />;
// }

function PlanCard({ exam, onNavigate }: { exam: ExamConfig; onNavigate: () => void }) {
  const plan = useActivePlan(exam).data;
  const name = useActivePlanName(exam, plan);
  if (!plan) return null;
  const hasExpiry = !!plan.expiryDate && plan.durationMonths > 0 && !Number.isNaN(new Date(plan.expiryDate).getTime());
  return (
    <div className="mt-auto pt-6">
      {/* Collapsed rail: crown only. Expanded (hover / mobile drawer): the full card. */}
      <div className="bg-rail-active border-rail-active-line flex size-16 items-center justify-center rounded-[16px] border border-solid group-hover/rail:hidden group-data-[open=true]/rail:hidden max-md:hidden">
        <Crown aria-hidden className="text-brand size-7" />
      </div>
      <div className="bg-rail-active border-rail-active-line hidden w-[199px] rounded-[16px] border border-solid p-3 group-hover/rail:block group-data-[open=true]/rail:block max-md:block">
        <span className="text-foreground-muted flex items-center gap-2 text-[12px] font-medium">
          <span className="bg-success size-2 rounded-full" />
          Active plan
        </span>
        <p className="text-foreground mt-2 text-[15px] leading-snug font-bold break-words">{name}</p>
        {hasExpiry && plan.expiryDate && (
          <>
            <p className="text-foreground-muted mt-0.5 text-[12px]">Ends {formatDate(plan.expiryDate)}</p>
            <div className="bg-brand-150 mt-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${remainingPercent(plan.expiryDate, plan.durationMonths)}%` }}
              />
            </div>
          </>
        )}
        <Link
          href={routes.managePlans()}
          onClick={onNavigate}
          className="text-brand mt-2 inline-block text-[13px] font-semibold hover:underline"
        >
          Manage plan
        </Link>
      </div>
    </div>
  );
}

/**
 * Competitive (NEET) sidebar (Figma "Sidebar" 823:18189): a 92px icon rail (64px icon tiles) that expands over the
 * page to the 227px labelled sidebar on hover. On mobile it's a drawer opened from the header's menu button.
 */
export function CompetitiveSidebar({ exam, rail = true }: { exam: ExamConfig; rail?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { open, setOpen } = useMobileNav();
  const [resolving, setResolving] = useState(false);
  const { restricted } = useFeatureAccess(exam);
  const close = () => setOpen(false);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  const openDailyPractice = async () => {
    if (resolving) return;
    setResolving(true);
    close();
    const href = await resolveDailyPractice(exam, () =>
      queryClient.fetchQuery({ queryKey: shellKeys.liveDpp(exam.slug), queryFn: () => shellApi.liveDpp(exam) }),
    );
    setResolving(false);
    router.push(href);
  };

  const item = (nav: NavItem) => {
    const href = nav.href(exam.slug);
    const active = isActivePath(href, pathname);
    // Competitive items have no plan locks; only the institute's (features/feature-access).
    const locked = isNavLocked(nav, { hasPlan: true, hasStudyPlan: true, restricted });
    // 64px row, 18px inset (17px + the 1px border that only the active item shows).
    const className = cx(
      'flex h-16 w-full items-center gap-[10px] rounded-[16px] border border-solid px-[17px] text-[14px] transition-colors',
      active
        ? 'bg-rail-active border-rail-active-line text-rail-active-text font-semibold'
        : 'text-rail-text hover:bg-canvas border-transparent font-medium',
    );
    const body = (
      <>
        <span className="relative shrink-0">
          <nav.icon aria-hidden className="size-[22px]" strokeWidth={2} />
          {locked && (
            <span title={lockLabel(locked)} className="bg-surface text-brand absolute -top-1.5 -right-1.5 rounded-full p-0.5 shadow-sm">
              <Lock aria-label={lockLabel(locked)} className="size-3" />
            </span>
          )}
        </span>
        {/* <NavIcon nav={nav} active={active} /> */}
        <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-200 group-hover/rail:opacity-100 group-data-[open=true]/rail:opacity-100 max-md:opacity-100">
          {nav.label}
        </span>
      </>
    );
    return (
      <li key={nav.key}>
        {locked ? (
          <button
            type="button"
            onClick={lockedClick(nav, locked)}
            aria-label={nav.label}
            aria-disabled="true"
            title={lockLabel(locked)}
            className={cx(className, 'cursor-not-allowed opacity-60')}
          >
            {body}
          </button>
        ) : nav.opens === 'live-dpp' ? (
          <button
            type="button"
            onClick={openDailyPractice}
            disabled={resolving}
            aria-busy={resolving}
            aria-label={nav.label}
            className={cx(className, 'disabled:cursor-wait disabled:opacity-60')}
          >
            {body}
          </button>
        ) : (
          <Link href={href} onClick={close} aria-label={nav.label} aria-current={active ? 'page' : undefined} className={className}>
            {body}
          </Link>
        )}
      </li>
    );
  };

  return (
    <>
      {open && <div className="bg-neutral-950/40 fixed inset-0 z-[90] md:hidden" onClick={close} aria-hidden="true" />}
      {rail && <div className="bg-surface hidden w-[92px] shrink-0 md:block" aria-hidden="true" />}
      <aside
        data-open={open}
        className={cx(
          // Same 14px side padding collapsed and expanded, so the icons don't move when the rail opens.
          'group/rail border-rail-line bg-surface fixed left-0 flex flex-col overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-r-2 border-solid px-[14px] py-10 transition-all duration-300',
          'top-0 z-[100] h-dvh w-[227px] md:top-[76px] md:z-30 md:h-[calc(100dvh-76px)] md:w-[92px] md:translate-x-0 md:hover:w-[227px]',
          open ? 'translate-x-0' : '-translate-x-full',
          // Chapter pages show the chapter sidebar instead; the menu drawer still opens on mobile.
          !rail && 'md:hidden',
        )}
      >
        <div className="-mt-6 mb-2 flex justify-end md:hidden">
          <button type="button" onClick={close} aria-label="Close menu" className="text-foreground-muted p-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-0">{navigationFor(exam).map(item)}</ul>
        </nav>
        <PlanCard exam={exam} onNavigate={close} />
      </aside>
    </>
  );
}
