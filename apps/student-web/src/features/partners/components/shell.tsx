'use client';

import { DollarSign, House, LogOut, Shield, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { partnerRoutes, type PartnerProfile } from '../api';
import { arrangement, initials } from '../format';
import { usePartnerLogout } from '../hooks';
import { ASSET } from './chrome';

export type ShellPage = 'dashboard' | 'payouts' | 'kyc';

const NAV: { key: ShellPage; label: string; href: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Dashboard', href: partnerRoutes.dashboard, icon: House },
  { key: 'payouts', label: 'Payouts', href: partnerRoutes.payouts, icon: DollarSign },
  { key: 'kyc', label: 'KYC & bank', href: partnerRoutes.bankDetails, icon: Shield },
];

/** Full-screen spinner shown while a partner page loads. */
export function PartnerLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="bg-partner-loading text-partner-grey grid min-h-screen w-full place-items-center font-sans">
      <div className="flex items-center gap-2.5" role="status">
        <div className="border-brand-700 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}

/** Could not load: message and a retry button, in the same frame as the loading screen. */
export function PartnerLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-partner-loading text-partner-grey grid min-h-screen w-full place-items-center font-sans">
      <div role="alert" className="flex flex-col items-center gap-3 text-center text-[14px]">
        <p className="text-brand-950 text-[16px] font-semibold">We couldn&apos;t load your partner account.</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-brand-700 text-neutral-0 hover:bg-partner-hover rounded-md px-5 py-2.5 font-bold transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/** Top bar (logo, partner, logout), sidebar navigation with the commission arrangement, and the page. */
export function PartnerShell({ profile, active, children }: { profile: PartnerProfile; active: ShellPage; children: ReactNode }) {
  const logout = usePartnerLogout();
  return (
    <div className="bg-partner-canvas flex h-screen w-full flex-col font-sans leading-[1.75]">
      <header className="border-partner-rule bg-neutral-0 flex h-[72px] shrink-0 items-center gap-6 border-b px-6">
        <div className="flex items-center gap-4">
          <Image src={`${ASSET}/logo-dark.png`} alt="Prepzy" width={100} height={32} className="h-auto w-[92px] object-contain" />
          <div className="bg-brand-950/15 mt-[4px] h-5 w-px" />
          <span className="text-partner-label mt-[4px] text-[12px] font-semibold tracking-[2px] uppercase">Partners</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-brand-950 text-[13px] leading-tight font-semibold">{profile.name}</div>
            <div className="text-partner-grey text-[11.5px] leading-tight">{profile.typeName || 'Partner'}</div>
          </div>
          <div className="from-partner-avatar-from to-partner-avatar-to ring-neutral-0 text-neutral-0 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-linear-135 text-[13px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.15)] ring-2">
            {initials(profile.name)}
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            title="Logout"
            aria-label="Logout"
            className="text-partner-grey hover:bg-partner-red-soft hover:text-partner-red grid h-9 w-9 place-items-center rounded-[10px] transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="border-partner-rule bg-neutral-0 hidden w-[240px] shrink-0 flex-col gap-1.5 border-r p-6 md:flex">
          <nav className="flex flex-col gap-1.5" aria-label="Partner">
            {NAV.map(({ key, label, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                aria-current={active === key ? 'page' : undefined}
                className={`flex items-center gap-4 rounded-md px-3.5 py-4 no-underline transition-colors ${
                  active === key
                    ? 'bg-brand-700 text-neutral-0 shadow-[0_4px_14px_rgba(61,52,139,0.35)]'
                    : 'text-partner-nav hover:bg-brand-50'
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                <span className="text-[13.5px] font-semibold">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-partner-amber-line bg-partner-amber-soft mt-auto rounded-lg border p-6">
            <div className="text-partner-amber text-[10.5px] font-bold tracking-[0.08em] uppercase">Your arrangement</div>
            <div className="text-brand-950 mt-2 text-[16px] font-bold">{arrangement(profile)}</div>
            {profile.commissionType === 'percent' && (
              <div className="text-partner-nav mt-1.5 text-[12px]">
                Floor ₹{profile.commissionFloor ?? 0} · Cap ₹{profile.commissionCap ?? '—'}
              </div>
            )}
            {profile.typeName && (
              <span className="border-partner-amber-chip bg-neutral-0 text-partner-amber mt-2.5 inline-block rounded-[6px] border px-2 py-1 text-[10px] font-bold">
                {profile.typeName}
              </span>
            )}
          </div>
        </aside>

        <main className="bg-partner-canvas flex-1 overflow-y-auto p-12">{children}</main>
      </div>
    </div>
  );
}
