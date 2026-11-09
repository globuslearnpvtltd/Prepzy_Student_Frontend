'use client';

import { cx } from '@prepzy/design-system';
import { Menu, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import { REFERENCE, type ExamCategory, type ExamConfig } from '@/shared/config/exams';
import { HEADER_LINKS } from '@/shared/config/navigation';
import { routes } from '@/shared/config/routes';
import { AccountMenu, AccountMenuBody, Avatar, ProfileHeader } from './account-menu';
import { DrawerClassSwitcher } from './class-switcher';
import { ExamSelector } from './exam-selector';
import { useMobileNav } from './mobile-nav-store';
import { SearchBox } from './search-box';

function Logo({ exam, compact = false }: { exam: ExamConfig | null; compact?: boolean }) {
  return (
    <Link
      href={exam ? routes.dashboard(exam.slug) : routes.referenceBooks()}
      aria-label="Prepzy home"
      className="shrink-0 transition-transform duration-300 hover:scale-105"
    >
      {compact ? (
        <Image src="/brand/logo-mark.png" alt="Prepzy" width={40} height={40} priority className="size-10" />
      ) : (
        <Image src="/brand/logo.png" alt="Prepzy" width={104} height={38} priority className="h-[38px] w-auto" />
      )}
    </Link>
  );
}

/** Dashboard / Courses pills (board), Dashboard (competitive). */
function HeaderLinks({ exam, category }: { exam: ExamConfig | null; category: ExamCategory }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Header" className="flex h-full items-center gap-[15px]">
      {HEADER_LINKS[category].map((link) => {
        const href = link.href(exam?.slug ?? '');
        const active = pathname === href;
        return (
          <Link
            key={link.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex h-[37px] items-center rounded-[15px] border-[1.5px] px-2.5 text-[16px] leading-4 font-bold transition-colors',
              active
                ? 'bg-brand text-on-brand border-brand'
                : 'text-foreground hover:border-brand hover:text-brand border-transparent',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Board mobile: menu drawer from the right with the profile card, class switcher, exams and account links. */
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
          showExams
          showReferral
          onNavigate={onClose}
          top={
            <div className="bg-brand flex flex-col items-center gap-2 rounded-lg p-3">
              <div className="flex w-full items-center gap-4">
                <Avatar student={user.data} size="sm" />
                <div className="flex flex-col">
                  <span className="text-on-brand text-[16px] font-semibold">{user.data?.fullName}</span>
                  <span className="text-on-brand/80 text-[12px]">{user.data?.phone}</span>
                </div>
              </div>
              <DrawerClassSwitcher exam={exam} onSwitched={onClose} />
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
          showExams
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
 * Top bar for every page with the shell. Desktop: logo, header links, search, exam selector, account menu.
 * Mobile: board = logo + search + menu drawer; competitive = navigation drawer button + centred logo + search + account.
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
    <header className="bg-surface shadow-header sticky top-0 z-50 w-full">
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <div className="mx-auto hidden h-[76px] w-full max-w-[1440px] items-center gap-10 md:flex">
        <div className="flex items-center gap-6">
          <div className="flex w-40">
            <Logo exam={exam} />
          </div>
          <HeaderLinks exam={exam} category={category} />
        </div>
        <div className="flex grow items-center justify-end gap-[18px]">
          {exam && <SearchBox exam={exam} className="w-[416px] max-lg:w-[240px]" />}
          <ExamSelector current={exam} fallbackLabel={exam ? undefined : REFERENCE.label} />
          <AccountMenu exam={exam} />
        </div>
      </div>

      {category === 'competitive' ? (
        <div className="relative flex h-[70px] items-center justify-between px-3 md:hidden">
          <button type="button" onClick={toggleNav} aria-label="Open navigation" className="text-neutral-800">
            <Menu aria-hidden className="size-6" />
          </button>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Logo exam={exam} />
          </div>
          <MobileActions
            exam={exam}
            panel={panel}
            toggle={toggle}
            label="Open account menu"
            avatar={<Avatar student={user.data} size="sm" />}
          />
        </div>
      ) : (
        <div className="flex h-[70px] items-center justify-between px-4 md:hidden">
          <Logo exam={exam} compact />
          <MobileActions
            exam={exam}
            panel={panel}
            toggle={toggle}
            label={drawerMenu ? 'Open menu' : 'Open account menu'}
            avatar={drawerMenu ? <Menu aria-hidden className="size-7 text-neutral-800" /> : <Avatar student={user.data} size="sm" />}
          />
        </div>
      )}

      {panel === 'search' && exam && (
        <div className="bg-surface px-4 pb-3 md:hidden">
          <SearchBox exam={exam} onNavigate={close} />
        </div>
      )}
      {panel === 'menu' && (drawerMenu ? <BoardDrawer exam={exam} onClose={close} /> : <AccountPanel exam={exam} onClose={close} />)}
    </header>
  );
}

function MobileActions({
  exam,
  panel,
  toggle,
  label,
  avatar,
}: {
  exam: ExamConfig | null;
  panel: 'search' | 'menu' | null;
  toggle: (panel: 'search' | 'menu') => void;
  label: string;
  avatar: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {exam && (
        <button type="button" onClick={() => toggle('search')} aria-label="Open search" aria-expanded={panel === 'search'}>
          <Search aria-hidden className="size-6 text-neutral-800" />
        </button>
      )}
      <button type="button" onClick={() => toggle('menu')} aria-label={label} aria-expanded={panel === 'menu'}>
        {panel === 'menu' ? <X aria-hidden className="size-7" /> : avatar}
      </button>
    </div>
  );
}
