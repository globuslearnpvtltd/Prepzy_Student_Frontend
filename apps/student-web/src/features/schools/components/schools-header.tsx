'use client';

import { ChevronRight, LayoutGrid, LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTeacher, useTeacherLogout } from '../hooks';
import { schoolsRoutes } from '../model';

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/** Portal header: logo, Dashboard tab and the teacher menu (name, email, logout); a slide-in drawer on mobile. */
export function SchoolsHeader() {
  const { data: teacher } = useTeacher();
  const logout = useTeacherLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = teacher?.firstName || 'Teacher';
  const email = teacher?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const signOut = () => {
    if (!logout.isPending) logout.mutate();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  return (
    <div className="bg-neutral-0 shadow-header sticky top-0 z-20 w-full">
      <header className="bg-neutral-0 mx-auto hidden h-[76px] w-full max-w-[1440px] items-center justify-between px-8 md:flex">
        <Link
          href={schoolsRoutes.dashboard()}
          aria-label="Prepzy home"
          className="w-[160px] shrink-0 transition-transform duration-300 ease-in-out hover:scale-[1.05]"
        >
          <Image src="/brand/logo.png" alt="Prepzy" width={104} height={38} priority className="h-auto w-[65%]" />
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href={schoolsRoutes.dashboard()}
            className="text-brand-700 bg-brand-700/10 border-brand-700/20 hover:bg-brand-700/20 flex h-[42px] w-[176px] items-center justify-center rounded-[10px] border text-[14px] font-semibold transition-colors"
          >
            Dashboard
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="bg-accent-500 text-neutral-0 shadow-card flex h-[42px] w-[42px] items-center justify-center rounded-full text-[16px] font-bold transition-transform hover:scale-105"
            >
              {initial}
            </button>

            {menuOpen && (
              <div className="bg-neutral-0 border-schools-menu shadow-schools-pop absolute top-[52px] right-0 z-50 w-[240px] rounded-lg border p-4">
                <div className="border-schools-menu mb-3 border-b pb-3">
                  <p className="text-[14px] leading-[20px] font-semibold text-neutral-950">{name}</p>
                  {email && <p className="text-schools-muted text-[12px] leading-[16px]">{email}</p>}
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={logout.isPending}
                  className="bg-schools-logout-soft border-schools-logout-line text-schools-logout hover:bg-danger-50 flex w-full items-center justify-center gap-2 rounded-[10px] border py-[10px] text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {logout.isPending ? <Spinner /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
                  {logout.isPending ? 'Logging out…' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile */}
      <header className="bg-neutral-0 flex h-[70px] w-full items-center justify-between px-4 md:hidden">
        <Link href={schoolsRoutes.dashboard()} aria-label="Prepzy home">
          <Image
            src="/brand/logo-mark.png"
            alt="Prepzy"
            width={40}
            height={40}
            priority
            className="w-[40px] scale-110"
          />
        </Link>
        <button
          type="button"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((open) => !open)}
          className="text-neutral-800"
        >
          {drawerOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {drawerOpen && (
        <div
          className="bg-night-950/40 fixed inset-0 z-[998] backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <nav
        aria-label="Menu"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`bg-neutral-0 fixed top-0 right-0 z-[999] flex h-dvh w-[85%] flex-col shadow-lg transition-transform duration-300 ease-in-out md:hidden ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mt-5 flex flex-1 flex-col space-y-3 overflow-y-auto px-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[24px] leading-[32px] font-semibold text-neutral-900">MENU</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="bg-neutral-0 border-brand-700/20 rounded-full border-2 p-2"
            >
              <X size={12} className="text-neutral-800" />
            </button>
          </div>

          <div className="bg-brand-700 flex items-center gap-4 rounded-lg p-[12px]">
            <div className="bg-accent-500 text-neutral-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-neutral-0 text-[16px] font-semibold">{name}</p>
              {email && <p className="text-neutral-0/70 truncate text-[12px]">{email}</p>}
            </div>
          </div>

          <Link
            href={schoolsRoutes.dashboard()}
            onClick={() => setDrawerOpen(false)}
            className="bg-neutral-0 border-schools-menu hover:bg-brand-700/5 flex items-center justify-between rounded-lg border p-[12px] transition-colors"
          >
            <span className="bg-brand-700/10 text-brand-700 rounded-md p-[10px]">
              <LayoutGrid size={20} aria-hidden="true" />
            </span>
            <span className="ml-3 flex flex-1 flex-col">
              <span className="text-[14px] font-bold text-neutral-950">Dashboard</span>
              <span className="text-schools-muted text-[10px]">Go to your dashboard</span>
            </span>
            <ChevronRight size={19} className="text-schools-muted" aria-hidden="true" />
          </Link>
        </div>

        <button
          type="button"
          onClick={signOut}
          disabled={logout.isPending}
          className="bg-neutral-0 border-schools-menu text-schools-logout hover:bg-danger-50 mx-3 mt-auto mb-[60px] flex items-center justify-center gap-2 rounded-lg border p-3 text-[14px] font-bold transition-colors disabled:opacity-60"
        >
          {logout.isPending && <Spinner />}
          {logout.isPending ? 'Logging out…' : 'Logout'}
        </button>
      </nav>
    </div>
  );
}
