'use client';

import { cx } from '@prepzy/design-system';
import { Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import type { ExamCategory, ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { AccountMenu, AccountMenuBody, Avatar, ProfileHeader } from './account-menu';
import { GoalMenu, GoalSheet } from './goal-switcher';
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

/** Board mobile: menu drawer from the right with the profile card and account links (classes switch from the goals pill). */
function BoardDrawer({ exam, onClose }: { exam: ExamConfig; onClose: () => void }) {
  const user = useCurrentUser();
  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[100] md:hidden">
      <div className="bg-neutral-950/40 absolute inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="bg-surface absolute top-0 right-0 flex h-dvh w-[85%] flex-col overflow-y-auto px-3 pt-5 pb-4 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-foreground text-[24px] font-semibold">MENU</span>
          <button type="button" onClick={onClose} aria-label="Close menu" className="border-line rounded-full border-2 p-2">
            <X aria-hidden className="size-3" />
          </button>
        </div>
        <AccountMenuBody
          exam={exam}
          showReferral
          onNavigate={onClose}
          top={
            <div className="bg-brand flex w-full items-center gap-4 rounded-lg p-3">
              <Avatar student={user.data} size="sm" />
              <div className="flex flex-col">
                <span className="text-on-brand text-[16px] font-semibold">{user.data?.fullName}</span>
                <span className="text-on-brand/80 text-[12px]">{user.data?.phone}</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

/** Competitive mobile: floating account panel under the avatar. */
function AccountPanel({ exam, onClose }: { exam: ExamConfig | null; onClose: () => void }) {
  const user = useCurrentUser();
  return (
    <div role="dialog" aria-label="Account" className="md:hidden">
      <div className="bg-neutral-950/40 fixed inset-0 z-[98] backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="border-line bg-surface absolute top-[70px] right-3 z-[99] max-h-[80vh] w-[300px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border p-4 shadow-lg">
        <AccountMenuBody
          exam={exam}
          onNavigate={onClose}
          top={
            exam ? (
              <div className="border-line flex items-center gap-3 border-b pb-3">
                <Avatar student={user.data} size="sm" />
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-neutral-950">{user.data?.fullName}</span>
                  <span className="text-foreground-muted text-[13px]">{user.data?.phone}</span>
                </div>
              </div>
            ) : (
              <ProfileHeader student={user.data} />
            )
          }
        />
      </div>
    </div>
  );
}

/**
 * Top bar for every page with the shell, the same for every exam: logo, the "{Exam} · {Class}" goals pill, search and
 * the account menu. Mobile adds the navigation drawer button (competitive) and opens search / the account menu
 * in panels; the goals pill opens a bottom sheet.
 *
 * Fixed (not sticky) to the viewport: it never moves with the page, including the rubber-band overscroll of
 * touchpads and phones. `HeaderSpacer` reserves its height in the flow.
 */
export function AppHeader({ exam, category }: { exam: ExamConfig | null; category: ExamCategory }) {
  const user = useCurrentUser();
  const pathname = usePathname();
  const toggleNav = useMobileNav((state) => state.toggle);
  const [panel, setPanel] = useState<'search' | 'menu' | null>(null);
  const toggle = (next: 'search' | 'menu') => setPanel((current) => (current === next ? null : next));
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
          <div className="flex grow items-center justify-end gap-4">
            {exam && <SearchBox exam={exam} className="w-[360px] max-lg:w-[240px]" />}
            <AccountMenu exam={exam} />
          </div>
        </div>

        <div className="flex h-[70px] items-center gap-3 px-4 md:hidden">
          {category === 'competitive' && (
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
              aria-label="Open account menu"
              aria-expanded={panel === 'menu'}
              className="flex size-9 items-center justify-center"
            >
              {panel === 'menu' ? <X aria-hidden className="size-7" /> : <Avatar student={user.data} size="sm" />}
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
