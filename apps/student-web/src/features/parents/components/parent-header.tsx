'use client';

import { ChevronRight, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@prepzy/design-system';
import { PORTALS } from '@/shared/config/portals';
import { useParent, useParentLogout } from '../hooks';
import { fullName, initials } from '../model';

function LogoutIcon() {
  return (
    <svg aria-hidden width="16" height="16" fill="none" viewBox="0 0 24 24" className="stroke-schools-logout">
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg aria-hidden className="text-schools-logout size-4 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/** Portal header: logo, Dashboard tab and the profile menu with Logout (drawer on mobile). */
export function ParentHeader() {
  const { data: parent } = useParent();
  const logout = useParentLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const name = parent ? fullName(parent) || 'Parent' : 'Parent';
  const contacts = parent ? [parent.email, parent.phone].filter(Boolean) : [];
  const badge = initials(parent?.firstName || name).slice(0, 1);
  const signOut = () => {
    if (!logout.isPending) logout.mutate();
  };

  return (
    <div className="bg-surface shadow-header sticky top-0 z-20 w-full">
      <header className="bg-surface mx-auto hidden h-[76px] w-full max-w-[1440px] items-center justify-between px-8 md:flex">
        <Link
          href={PORTALS.parents.home}
          className="w-[160px] shrink-0 transition-transform duration-300 ease-in-out hover:scale-[1.05]"
        >
          <Image src="/brand/logo.png" alt="Prepzy" width={96} height={35} priority className="h-[35px] w-auto" />
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href={PORTALS.parents.home}
            aria-current="page"
            className="text-brand-700 bg-brand-700/10 border-brand-700/20 hover:bg-brand-700/20 rounded-[10px] border px-[48px] py-[10px] text-[14px]/[20px] font-semibold transition-colors"
          >
            Dashboard
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="bg-accent-500 text-neutral-0 shadow-card flex size-[42px] items-center justify-center rounded-full text-[16px] font-bold transition-transform hover:scale-105"
            >
              {badge}
            </button>
            {menuOpen && (
              <div className="bg-surface border-schools-menu shadow-schools-pop absolute top-[52px] right-0 z-50 w-[240px] rounded-[16px] border p-4">
                <div className="border-schools-menu mb-3 border-b pb-3">
                  <p className="text-neutral-950 text-[14px]/[20px] font-semibold">{name}</p>
                  {contacts.map((c) => (
                    <p key={c} className="text-schools-muted text-[12px]/[16px] break-words">
                      {c}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={logout.isPending}
                  className={cx(
                    'bg-schools-logout-soft border-schools-logout-line text-schools-logout flex w-full items-center justify-center gap-2 rounded-[10px] border py-[10px] text-[14px]/[20px] font-semibold transition-colors',
                    logout.isPending ? 'cursor-not-allowed opacity-60' : 'hover:bg-schools-logout-line',
                  )}
                >
                  {logout.isPending ? <Spinner /> : <LogoutIcon />}
                  {logout.isPending ? 'Logging out…' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <header className="bg-surface flex h-[70px] w-full items-center justify-between px-4 md:hidden">
        <Link href={PORTALS.parents.home}>
          <Image src="/brand/logo-mark.png" alt="Prepzy" width={40} height={40} priority className="size-10" />
        </Link>
        <button
          type="button"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setDrawerOpen((open) => !open)}
          className="text-plan-cbse"
        >
          {drawerOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {drawerOpen && (
        <div
          aria-hidden
          className="bg-night-900/40 fixed inset-0 z-[998] backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <nav
        aria-label="Menu"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={cx(
          'bg-surface fixed top-0 right-0 z-[999] flex h-screen w-[85%] flex-col shadow-lg transition-transform duration-300 ease-in-out md:hidden',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto px-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-neutral-900 text-[24px]/[32px] font-semibold">MENU</span>
            <button
              type="button"
              aria-label="Close menu"
              className="bg-surface border-brand-700/20 rounded-full border-2 p-2"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={12} className="text-plan-cbse" />
            </button>
          </div>
          <div className="bg-brand-700 flex items-center gap-4 rounded-[16px] p-[12px]">
            <span className="bg-accent-500 text-neutral-0 flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold">
              {badge}
            </span>
            <div className="min-w-0">
              <p className="text-neutral-0 text-[16px]/[24px] font-semibold">{name}</p>
              {contacts.map((c) => (
                <p key={c} className="text-neutral-0/70 text-[12px]/[16px] break-words">
                  {c}
                </p>
              ))}
            </div>
          </div>
          <Link
            href={PORTALS.parents.home}
            onClick={() => setDrawerOpen(false)}
            className="bg-surface border-schools-menu hover:bg-brand-700/5 flex items-center justify-between rounded-[16px] border p-[12px] transition-colors"
          >
            <span className="bg-brand-700/10 rounded-[12px] p-[10px]">
              <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-brand-700">
                <rect x="2" y="2" width="7" height="7" rx="1.5" strokeWidth="1.6" />
                <rect x="11" y="2" width="7" height="7" rx="1.5" strokeWidth="1.6" />
                <rect x="2" y="11" width="7" height="7" rx="1.5" strokeWidth="1.6" />
                <rect x="11" y="11" width="7" height="7" rx="1.5" strokeWidth="1.6" />
              </svg>
            </span>
            <span className="ml-3 flex flex-1 flex-col">
              <span className="text-neutral-950 text-[14px]/[20px] font-bold">Dashboard</span>
              <span className="text-schools-muted text-[10px]/[14px]">Go to your dashboard</span>
            </span>
            <ChevronRight size={19} className="text-schools-muted" />
          </Link>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={logout.isPending}
          className={cx(
            'bg-surface border-schools-menu text-schools-logout mx-3 mt-auto mb-[60px] flex items-center justify-center gap-2 rounded-[16px] border p-3 text-[14px]/[20px] font-bold transition-colors',
            logout.isPending ? 'cursor-not-allowed opacity-60' : 'hover:bg-schools-logout-soft',
          )}
        >
          {logout.isPending && <Spinner />}
          {logout.isPending ? 'Logging out…' : 'Logout'}
        </button>
      </nav>
    </div>
  );
}
