'use client';

import { cx } from '@prepzy/design-system';
import { ChevronRight, LayoutDashboard, Lock, Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import type { ExamCategory, ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { isNavLocked, navigationFor } from '@/shared/config/navigation';
import { AccountMenu, AccountMenuBody, Avatar, useMenuDot } from './account-menu';
import { useNavAccess } from './board-navigation';
import { GoalMenu, GoalSheet, useOwnedExams } from './goal-switcher';
import { useMobileNav } from './mobile-nav-store';
import { SearchBox } from './search-box';

function Logo({ exam, compact = false, className }: { exam: ExamConfig | null; compact?: boolean; className?: string }) {
  return (
    <Link
      href={exam ? routes.dashboard(exam.slug) : routes.referenceBooks()}
      aria-label="Prepzy home"
      className="shrink-0 transition-transform duration-300 hover:scale-105"
    >
      {compact ? (
        <Image src="/brand/logo-mark.png" alt="Prepzy" width={40} height={40} priority className="size-10" />
      ) : (
        <Image src="/brand/logo.png" alt="Prepzy" width={104} height={38} priority className={cx('w-auto', className ?? 'h-[38px]')} />
      )}
    </Link>
  );
}

/**
 * Desktop: "Dashboard" pill next to the goals pill, to the current exam's dashboard (pages without an exam: the
 * student's first owned exam, like the pill). Quiet secondary style, same height as the goals pill; brand-tinted with
 * aria-current="page" on the dashboard. Not on phones: the mobile header row has no room (navigation covers it).
 */
function DashboardLink({ exam }: { exam: ExamConfig | null }) {
  const pathname = usePathname();
  const owned = useOwnedExams();
  const home = exam ?? owned[0]?.exam ?? null;
  if (!home) return null;
  const href = routes.dashboard(home.slug);
  const active = pathname === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
        active ? 'border-brand-150 bg-brand-75 text-brand' : 'border-line bg-surface text-foreground-muted hover:bg-canvas hover:text-brand',
      )}
    >
      <LayoutDashboard aria-hidden className="size-4 shrink-0" />
      Dashboard
    </Link>
  );
}

/** Board mobile navigation the bottom bar doesn't carry (Study Plan, Refer & Earn …), with the sidebar's locks. */
function BoardDrawerNavigation({ exam, onNavigate }: { exam: ExamConfig; onNavigate: () => void }) {
  const access = useNavAccess(exam);
  const items = navigationFor(exam).filter((item) => !item.mobile);
  if (items.length === 0) return null;
  return (
    <nav aria-label="More" className="flex flex-col">
      {items.map((item) => {
        const locked = isNavLocked(item, access);
        const body = (
          <>
            <item.icon aria-hidden className="size-5 shrink-0 text-account-body" />
            <span>{item.label}</span>
            {locked ? (
              <Lock aria-label="Locked" className="ml-auto size-4 shrink-0 text-neutral-550" />
            ) : (
              <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-neutral-550" />
            )}
          </>
        );
        const className =
          'flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-[15px] font-medium text-account-ink hover:bg-account-soft';
        return locked ? (
          <span key={item.key} aria-disabled="true" className={cx(className, 'cursor-not-allowed opacity-60 hover:bg-transparent')}>
            {body}
          </span>
        ) : (
          <Link key={item.key} href={item.href(exam.slug)} onClick={onNavigate} className={className}>
            {body}
          </Link>
        );
      })}
    </nav>
  );
}

/** Board mobile: menu drawer from the right with the account menu and the navigation the bottom bar doesn't carry. */
function BoardDrawer({ exam, onClose }: { exam: ExamConfig; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[100] md:hidden">
      <div className="bg-neutral-950/40 absolute inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="bg-surface absolute top-0 right-0 flex h-dvh w-[85%] flex-col overflow-y-auto px-3 pt-5 pb-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-foreground text-[24px] font-semibold">MENU</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="border-line rounded-full border-2 p-2">
            <X aria-hidden className="size-3" />
          </button>
        </div>
        <AccountMenuBody exam={exam} onNavigate={onClose} extra={<BoardDrawerNavigation exam={exam} onNavigate={onClose} />} />
      </div>
    </div>
  );
}

/** Competitive (and exam-less) mobile: the account menu in a floating panel under the avatar. */
function AccountPanel({ exam, onClose }: { exam: ExamConfig | null; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="Account" className="md:hidden">
      <div className="bg-neutral-950/40 fixed inset-0 z-[98] backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="bg-surface absolute top-[70px] right-3 z-[99] max-h-[80vh] w-[300px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[20px] border border-account-line p-3 shadow-[0px_16px_44px_0px_rgba(26,23,51,0.12)]">
        <AccountMenuBody exam={exam} onNavigate={onClose} />
      </div>
    </div>
  );
}

/**
 * Top bar for every page with the shell, the same for every exam: logo, the goals pill ("{Exam} · {Class}", competitive: "{Class}"), search and
 * the account menu. Mobile adds the navigation drawer button (competitive) and opens search / the account menu
 * in panels; the goals pill opens a bottom sheet.
 *
 * Fixed (not sticky) to the viewport: it never moves with the page, including the rubber-band overscroll of
 * touchpads and phones. `HeaderSpacer` reserves its height in the flow.
 */
export function AppHeader({
  exam,
  category,
  navigation = true,
}: {
  exam: ExamConfig | null;
  category: ExamCategory;
  /** false: the page has no section navigation (account pages), so there's no drawer button. */
  navigation?: boolean;
}) {
  const user = useCurrentUser();
  const { dot, markSeen } = useMenuDot();
  const pathname = usePathname();
  const toggleNav = useMobileNav((state) => state.toggle);
  const [panel, setPanel] = useState<'search' | 'menu' | null>(null);
  const toggle = (next: 'search' | 'menu') => {
    if (next === 'menu') markSeen();
    setPanel((current) => (current === next ? null : next));
  };
  const close = () => setPanel(null);
  const drawerMenu = category === 'board' && exam;

  useEffect(() => setPanel(null), [pathname]);

  return (
    <>
      <header className="bg-surface shadow-header fixed inset-x-0 top-0 z-50 w-full">
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <div className="mx-auto hidden h-[76px] w-full max-w-[1440px] items-center gap-6 px-6 md:flex lg:px-9">
          <Logo exam={exam} />
          <GoalMenu exam={exam} />
          <DashboardLink exam={exam} />
          <div className="flex grow items-center justify-end gap-4">
            {exam && <SearchBox exam={exam} className="w-[360px] max-lg:w-[240px]" />}
            <AccountMenu exam={exam} />
          </div>
        </div>

        <div className="flex h-[70px] items-center gap-3 px-4 md:hidden">
          {category === 'competitive' && navigation && (
            <button type="button" onClick={toggleNav} aria-label="Open navigation" className="-ml-1 shrink-0 p-1 text-neutral-800">
              <Menu aria-hidden className="size-6" />
            </button>
          )}
          {category === 'competitive' ? <Logo exam={exam} compact /> : <Logo exam={exam} className="h-8" />}
          <div className="flex min-w-0 flex-1">
            <GoalSheet exam={exam} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {exam && (
              <button
                type="button"
                onClick={() => toggle('search')}
                aria-label="Open search"
                aria-expanded={panel === 'search'}
                className="flex size-9 items-center justify-center"
              >
                <Search aria-hidden className="size-6 text-neutral-800" />
              </button>
            )}
            <button
              type="button"
              onClick={() => toggle('menu')}
              aria-label={dot ? 'Open account menu (new: Medium)' : 'Open account menu'}
              aria-expanded={panel === 'menu'}
              className="flex size-9 items-center justify-center"
            >
              {panel === 'menu' ? <X aria-hidden className="size-7" /> : <Avatar student={user.data} size="sm" dot={dot} />}
            </button>
          </div>
        </div>

        {panel === 'search' && exam && (
          <div className="bg-surface px-4 pb-3 md:hidden">
            <SearchBox exam={exam} onNavigate={close} />
          </div>
        )}
        {panel === 'menu' && (drawerMenu ? <BoardDrawer exam={exam} onClose={close} /> : <AccountPanel exam={exam} onClose={close} />)}
      </header>
      <HeaderSpacer />
    </>
  );
}

/** Keeps page content below the fixed header (70px on phones, 76px from md). */
export function HeaderSpacer() {
  return <div aria-hidden="true" className="h-[70px] shrink-0 md:h-[76px]" />;
}
