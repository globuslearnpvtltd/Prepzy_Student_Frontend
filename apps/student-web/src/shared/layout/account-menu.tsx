'use client';

import { cx } from '@prepzy/design-system';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight, CreditCard, Languages, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import { useCurrentUser, useLogout, type Student } from '@/features/auth';
import { mediumLabel, useCurrentLanguage, useMediumDialog } from '@/features/language';
import type { ExamConfig } from '@/shared/config/exams';
import { routes } from '@/shared/config/routes';
import { useOwnedExams } from './goal-switcher';

export function initialsOf(student: Pick<Student, 'firstName' | 'lastName'> | undefined): string {
  if (!student) return 'U';
  const first = student.firstName.charAt(0).toUpperCase();
  const last = student.lastName.charAt(0).toUpperCase();
  return first ? first + last : 'U';
}

/** "+91 63036 32127" for Indian numbers (10 digits, with or without 91); anything else as stored. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 10 ? digits : null;
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : phone;
}

/** Orange initials circle (or the profile photo) used by every account button; `dot` adds the red "new" dot. */
export function Avatar({ student, size = 'md', dot = false }: { student: Student | undefined; size?: 'sm' | 'md' | 'lg'; dot?: boolean }) {
  const box = size === 'md' ? 'size-12 text-lg' : size === 'lg' ? 'size-[42px] text-[16px]' : 'size-9 text-sm';
  const face = student?.profilePicture ? (
    // Profile photos come from several CDNs; a plain img avoids listing each in next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={student.profilePicture} alt="" className={cx(box, 'border-line rounded-full border object-cover')} />
  ) : (
    <span className={cx(box, 'bg-accent text-on-brand flex items-center justify-center rounded-full font-semibold')}>
      {initialsOf(student)}
    </span>
  );
  if (!dot) return face;
  return (
    <span className="relative inline-flex">
      {face}
      <span
        data-testid="account-menu-dot"
        aria-hidden="true"
        className="border-surface absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 bg-account-logout"
      />
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * "New" dot: the avatar shows a red dot (for the new Medium row) until the student opens the menu once.
 * Per browser; when storage is blocked (private mode) the dot just goes away for this visit.
 * ---------------------------------------------------------------------------------------------- */

export const MENU_SEEN_KEY = 'prepzy:account-menu-seen';

const useMenuSeenStore = create<{ seen: boolean; hydrated: boolean; hydrate: () => void; markSeen: () => void }>((set, get) => ({
  // Server render and first client render: no dot, so the markup matches; hydrate() then reads the browser's value.
  seen: true,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    let seen = false;
    try {
      seen = localStorage.getItem(MENU_SEEN_KEY) === '1';
    } catch {
      // Blocked storage: treat as not seen.
    }
    set({ seen, hydrated: true });
  },
  markSeen: () => {
    try {
      localStorage.setItem(MENU_SEEN_KEY, '1');
    } catch {
      // Blocked storage: hidden for this visit only.
    }
    set({ seen: true, hydrated: true });
  },
}));

/** Tests only. */
export const resetMenuDot = () => useMenuSeenStore.setState({ seen: true, hydrated: false });

/** Whether the avatar shows the "new" dot, and the callback for opening the menu. */
export function useMenuDot() {
  const seen = useMenuSeenStore((state) => state.seen);
  const hydrate = useMenuSeenStore((state) => state.hydrate);
  const markSeen = useMenuSeenStore((state) => state.markSeen);
  useEffect(hydrate, [hydrate]);
  return { dot: !seen, markSeen };
}

/* ------------------------------------------------------------------------------------------------
 * Rows
 * ---------------------------------------------------------------------------------------------- */

const rowClass =
  'flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium text-account-ink outline-none transition-colors hover:bg-account-soft focus-visible:bg-account-soft data-[highlighted]:bg-account-soft';
const divider = 'mx-1 my-1 h-px bg-account-line';

/** A row: a Radix item in the desktop dropdown (keyboard, typeahead, closes on select), a plain element in the panels. */
function Row({
  asMenuItem,
  href,
  onSelect,
  disabled,
  className,
  label,
  children,
}: {
  asMenuItem: boolean;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  const classes = cx(rowClass, className);
  const element = href ? (
    <Link href={href} onClick={onSelect} aria-label={label} className={classes}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={asMenuItem ? undefined : onSelect} disabled={disabled} aria-label={label} className={classes}>
      {children}
    </button>
  );
  if (!asMenuItem) return element;
  return (
    <DropdownMenu.Item
      asChild
      disabled={disabled}
      onSelect={
        href
          ? undefined
          : (event) => {
              // Keep the menu open so the pending state ("Logging out…") stays visible.
              event.preventDefault();
              onSelect?.();
            }
      }
    >
      {element}
    </DropdownMenu.Item>
  );
}

function ProfileRow({ home, asMenuItem, onNavigate }: { home: ExamConfig | null; asMenuItem: boolean; onNavigate?: () => void }) {
  const user = useCurrentUser();
  const student = user.data;
  const phone = formatPhone(student?.phone);
  const body = (
    <>
      <Avatar student={student} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] leading-6 font-semibold text-account-ink">{student?.fullName || 'Student'}</span>
        {phone && <span className="truncate text-[13px] leading-5 font-normal text-neutral-550">{phone}</span>}
      </span>
      {home && <ChevronRight aria-hidden className="text-brand-700 size-5 shrink-0" />}
    </>
  );
  const className = 'bg-brand-50 hover:bg-brand-75 focus-visible:bg-brand-75 data-[highlighted]:bg-brand-75 rounded-[16px] p-3';
  if (!home) return <div className={cx(rowClass, className, 'hover:bg-brand-50')}>{body}</div>;
  return (
    <Row
      asMenuItem={asMenuItem}
      href={routes.profile(home.slug)}
      onSelect={onNavigate}
      label={`My profile: ${student?.fullName || 'Student'}`}
      className={className}
    >
      {body}
    </Row>
  );
}

function MediumBody() {
  const language = useCurrentLanguage();
  return (
    <>
      <Languages aria-hidden className="size-5 shrink-0 text-account-body" />
      <span>Medium</span>
      <span className="rounded-full bg-account-gold-soft px-2 py-0.5 text-[10px] leading-4 font-bold tracking-wide text-account-gold uppercase">New</span>
      <span className="ml-auto truncate text-[15px] font-normal text-neutral-550">{language ? mediumLabel(language.name).native : ''}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-550" />
    </>
  );
}

/**
 * Medium row: opens the change-medium dialog (rendered by the header, so it outlives the menu). The desktop
 * dropdown closes on select; the mobile panels close through onNavigate.
 */
function MediumRow({ asMenuItem, onNavigate }: { asMenuItem: boolean; onNavigate?: () => void }) {
  const language = useCurrentLanguage();
  const show = useMediumDialog((state) => state.show);
  const label = language ? `Medium: ${mediumLabel(language.name).native}` : 'Medium';
  if (asMenuItem) {
    return (
      <DropdownMenu.Item asChild onSelect={show}>
        <button type="button" aria-label={label} aria-haspopup="dialog" className={rowClass}>
          <MediumBody />
        </button>
      </DropdownMenu.Item>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => {
        onNavigate?.();
        show();
      }}
      className={rowClass}
    >
      <MediumBody />
    </button>
  );
}

function LogoutRow({ asMenuItem }: { asMenuItem: boolean }) {
  const logout = useLogout();
  return (
    <Row
      asMenuItem={asMenuItem}
      disabled={logout.isPending}
      onSelect={() => logout.mutate()}
      className="text-account-logout hover:bg-danger-50 focus-visible:bg-danger-50 disabled:opacity-60 data-[highlighted]:bg-danger-50"
    >
      <LogOut aria-hidden className="size-5 shrink-0" />
      {logout.isPending ? 'Logging out…' : 'Logout'}
    </Row>
  );
}

/**
 * Body of every account menu (desktop dropdown, competitive mobile panel, board mobile drawer): the profile row
 * (→ profile page), Medium, Manage Plans and Logout. `extra` adds rows after Manage Plans (the board drawer's navigation).
 */
export function AccountMenuBody({
  exam,
  asMenuItems = false,
  onNavigate,
  extra,
}: {
  exam: ExamConfig | null;
  asMenuItems?: boolean;
  onNavigate?: () => void;
  extra?: ReactNode;
}) {
  const owned = useOwnedExams();
  // Pages without an exam (reference books) open the first owned exam's profile.
  const home = exam ?? owned[0]?.exam ?? null;
  return (
    <div className="flex flex-col">
      <ProfileRow home={home} asMenuItem={asMenuItems} onNavigate={onNavigate} />
      <div className="pt-2">
        <MediumRow asMenuItem={asMenuItems} onNavigate={onNavigate} />
      </div>
      <div className={divider} />
      <Row asMenuItem={asMenuItems} href={routes.managePlans()} onSelect={onNavigate}>
        <CreditCard aria-hidden className="size-5 shrink-0 text-account-body" />
        <span>Manage Plans</span>
        <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-neutral-550" />
      </Row>
      {extra}
      <div className={divider} />
      <LogoutRow asMenuItem={asMenuItems} />
    </div>
  );
}

/** Desktop: the avatar (red dot until the menu is opened once) opening the account dropdown. */
export function AccountMenu({ exam }: { exam: ExamConfig | null }) {
  const user = useCurrentUser();
  const { dot, markSeen } = useMenuDot();
  return (
    <DropdownMenu.Root modal={false} onOpenChange={(open) => open && markSeen()}>
      <DropdownMenu.Trigger aria-label={dot ? 'Account menu (new: Medium)' : 'Account menu'} className="shrink-0 rounded-full">
        <Avatar student={user.data} dot={dot} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={12}
          // Opening the medium dialog closes the menu: focus stays with the dialog instead of returning to the avatar.
          onCloseAutoFocus={(event) => useMediumDialog.getState().open && event.preventDefault()}
          className="bg-surface z-[60] w-[300px] rounded-[20px] border border-account-line p-3 shadow-[0px_16px_44px_0px_rgba(26,23,51,0.12)]"
        >
          <AccountMenuBody exam={exam} asMenuItems />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
