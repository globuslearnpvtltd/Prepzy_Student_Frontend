'use client';

import { cx } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { useActivePlanName } from '@/features/plans';
import type { ExamConfig } from '@/shared/config/exams';
import { isActivePath, navigationFor, type NavItem } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
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

function PlanCard({ exam, onNavigate }: { exam: ExamConfig; onNavigate: () => void }) {
  const plan = useActivePlan(exam).data;
  const name = useActivePlanName(exam, plan);
  if (!plan) return null;
  const hasExpiry = !!plan.expiryDate && plan.durationMonths > 0 && !Number.isNaN(new Date(plan.expiryDate).getTime());
  return (
    <div className="mt-auto px-3">
      {/* Collapsed rail: crown only. Expanded (hover / mobile drawer): the full card. */}
      <div className="bg-brand-50 flex h-11 w-[52px] items-center justify-center rounded-md group-hover/rail:hidden group-data-[open=true]/rail:hidden">
        <Crown aria-hidden className="text-brand size-5" />
      </div>
      <div className="bg-brand-50 hidden w-[196px] rounded-lg p-3 group-hover/rail:block group-data-[open=true]/rail:block">
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
          href={routes.plans(exam.slug)}
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
 * Competitive (NEET) sidebar: a 76px icon rail that expands to 220px on hover. On mobile it's a drawer
 * opened from the header's menu button.
 */
export function CompetitiveSidebar({ exam, rail = true }: { exam: ExamConfig; rail?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { open, setOpen } = useMobileNav();
  const [resolving, setResolving] = useState(false);
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
    const className = cx(
      'flex h-11 w-full items-center gap-4 rounded-md px-3 text-[14px] font-medium transition-colors',
      active ? 'bg-brand-75 text-brand' : 'text-neutral-400 hover:bg-canvas hover:text-neutral-600',
    );
    const body = (
      <>
        <nav.icon aria-hidden className="size-[22px] shrink-0" strokeWidth={2} />
        <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-200 group-hover/rail:opacity-100 group-data-[open=true]/rail:opacity-100 max-md:opacity-100">
          {nav.label}
        </span>
      </>
    );
    return (
      <li key={nav.key}>
        {nav.opens === 'live-dpp' ? (
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
      {rail && <div className="bg-surface hidden w-[76px] shrink-0 md:block" aria-hidden="true" />}
      <aside
        data-open={open}
        className={cx(
          'group/rail border-line bg-surface fixed left-0 flex flex-col overflow-hidden border-r py-6 transition-all duration-300',
          'top-0 z-[100] h-dvh w-[220px] md:top-[76px] md:z-30 md:h-[calc(100dvh-76px)] md:w-[76px] md:translate-x-0 md:hover:w-[220px]',
          open ? 'translate-x-0' : '-translate-x-full',
          // Chapter pages show the chapter sidebar instead; the menu drawer still opens on mobile.
          !rail && 'md:hidden',
        )}
      >
        <div className="mb-2 flex justify-end px-1 md:hidden">
          <button type="button" onClick={close} aria-label="Close menu" className="text-foreground-muted p-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <nav aria-label="Main" className="px-3">
          <ul className="flex flex-col gap-1">{navigationFor(exam).map(item)}</ul>
        </nav>
        <PlanCard exam={exam} onNavigate={close} />
      </aside>
    </>
  );
}
