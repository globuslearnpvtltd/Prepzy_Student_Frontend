'use client';

import { cx } from '@prepzy/design-system';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { isDesktop } from '../hooks';

/** My Account icons (the previous app's /assets/profile, /assets/help and /assets/delete). */
export const icon = (name: string) => `/illustrations/profile/${name}`;

export function Icon({
  name,
  size,
  width,
  className,
  alt = '',
}: {
  name: string;
  size: number;
  width?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={icon(name)}
      width={width ?? size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={cx('shrink-0', className)}
    />
  );
}

// Inlined so the offline, error and loading states still draw once the browser is offline.
const STATE_ICONS = {
  offline:
    '<svg width="100%" height="100%" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-warning-strong)"><path d="M9 15H9.0075"/><path d="M6.375 12.3225C7.07598 11.6354 8.01843 11.2505 9 11.2505C9.98157 11.2505 10.924 11.6354 11.625 12.3225"/><path d="M1.5 6.615C2.42547 5.78418 3.48231 5.11257 4.6275 4.6275"/><path d="M7.995 3.75C11.0025 3.48 14.1 4.425 16.5 6.57"/><path d="M12.6375 8.4375C13.2485 8.77781 13.809 9.20192 14.3025 9.6975"/><path d="M3.75 9.75C4.82094 8.67901 6.19104 7.95735 7.68 7.68"/><path d="M1.5 1.5L16.5 16.5"/></g></svg>',
  error:
    '<svg width="100%" height="100%" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-danger-strong)"><path d="M23.8333 13C23.8333 18.9831 18.9831 23.8333 13 23.8333C7.01691 23.8333 2.16667 18.9831 2.16667 13C2.16667 7.01691 7.01691 2.16667 13 2.16667C18.9831 2.16667 23.8333 7.01691 23.8333 13Z"/><path d="M13 8.66667V13"/><path d="M13 17.3333H13.01"/></g></svg>',
  retry:
    '<svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="white"><path d="M2 8C2 6.4087 2.63214 4.88258 3.75736 3.75736C4.88258 2.63214 6.4087 2 8 2C9.67737 2.00631 11.2874 2.66082 12.4933 3.82667L14 5.33333"/><path d="M14 2V5.33333H10.6667"/><path d="M14 8C14 9.5913 13.3679 11.1174 12.2426 12.2426C11.1174 13.3679 9.5913 14 8 14C6.32263 13.9937 4.71265 13.3392 3.50667 12.1733L2 10.6667"/><path d="M5.33333 10.6667H2V14"/></g></svg>',
  alert:
    '<svg width="100%" height="100%" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-danger-strong)"><path d="M12.8333 7C12.8333 10.2217 10.2217 12.8333 7 12.8333C3.77834 12.8333 1.16667 10.2217 1.16667 7C1.16667 3.77834 3.77834 1.16667 7 1.16667C10.2217 1.16667 12.8333 3.77834 12.8333 7Z"/><path d="M7 4.66667V7"/><path d="M7 9.33333H7.00583"/></g></svg>',
  'loader-button':
    '<svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 9.26704 13.5989 10.5015 12.8541 11.5266C12.1094 12.5517 11.0593 13.3147 9.85424 13.7062C8.64922 14.0978 7.35118 14.0978 6.14614 13.7063C4.9411 13.3149 3.89092 12.5519 3.14611 11.5269C2.4013 10.5019 2.0001 9.26744 2 8.0004C1.9999 6.73336 2.40091 5.49881 3.14555 4.47369C3.8902 3.44856 4.94026 2.68547 6.14524 2.2938C7.35021 1.90212 8.64826 1.90196 9.85333 2.29333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="white"/></svg>',
  'loader-brand':
    '<svg width="100%" height="100%" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 8C14 9.26704 13.5989 10.5015 12.8541 11.5266C12.1094 12.5517 11.0593 13.3147 9.85424 13.7062C8.64922 14.0978 7.35118 14.0978 6.14614 13.7063C4.9411 13.3149 3.89092 12.5519 3.14611 11.5269C2.4013 10.5019 2.0001 9.26744 2 8.0004C1.9999 6.73336 2.40091 5.49881 3.14555 4.47369C3.8902 3.44856 4.94026 2.68547 6.14524 2.2938C7.35021 1.90212 8.64826 1.90196 9.85333 2.29333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-brand)"/></svg>',
  'toast-ok':
    '<svg width="100%" height="100%" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-success-light)"><path d="M16.5 8.31V9C16.4991 10.6173 15.9754 12.191 15.007 13.4864C14.0386 14.7817 12.6775 15.7294 11.1265 16.1879C9.57557 16.6465 7.91794 16.5914 6.40085 16.0309C4.88376 15.4705 3.58849 14.4346 2.70822 13.0778C1.82795 11.721 1.40984 10.116 1.51625 8.50224C1.62267 6.88842 2.2479 5.35224 3.29871 4.1228C4.34951 2.89336 5.76958 2.03654 7.34714 1.68011C8.92469 1.32368 10.5752 1.48675 12.0525 2.145"/><path d="M6.75 8.25L9 10.5L16.5 3"/></g></svg>',
  'toast-error':
    '<svg width="100%" height="100%" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--color-danger-light)"><path d="M16.5 9C16.5 13.1421 13.1421 16.5 9 16.5C4.85786 16.5 1.5 13.1421 1.5 9C1.5 4.85786 4.85786 1.5 9 1.5C13.1421 1.5 16.5 4.85786 16.5 9Z"/><path d="M11.25 6.75L6.75 11.25"/><path d="M6.75 6.75L11.25 11.25"/></g></svg>',
  'error-sm':
    '<svg width="100%" height="100%" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><g style="stroke:var(--color-danger-strong)" stroke-width="1.16667" stroke-linecap="round"><path d="M7 12.25C9.8995 12.25 12.25 9.8995 12.25 7C12.25 4.10051 9.8995 1.75 7 1.75C4.10051 1.75 1.75 4.10051 1.75 7C1.75 9.8995 4.10051 12.25 7 12.25Z"/><path d="M7 4.66667V7.58333M7 9.33333H7.00583"/></g></svg>',
} as const;

export type StateIconName = keyof typeof STATE_ICONS;

export function StateIcon({ name, size, className }: { name: StateIconName; size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: STATE_ICONS[name] }}
    />
  );
}

// ---- text helpers ----

/** "+91 98765 43210" for Indian numbers, the stored value otherwise. */
export const formatPhone = (phone?: string | null) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
};

export const initialsOf = (firstName?: string, lastName?: string) =>
  `${firstName?.trim()?.[0] ?? ''}${lastName?.trim()?.[0] ?? ''}`.toUpperCase() || 'U';

export const fullName = (p: { firstName?: string; lastName?: string }) =>
  `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();

export const formatDay = (value: Date | string | null | undefined, withYear = true) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(
    'en-GB',
    withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' },
  );
};

// ---- avatar ----

export function ProfileAvatar({
  picture,
  firstName,
  lastName,
  size,
}: {
  picture: string | null;
  firstName: string;
  lastName: string;
  size: number;
}) {
  if (picture) {
    // Photos come from several CDNs; a plain img avoids listing each in next.config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={picture}
        alt="Profile photo"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.32 }}
      className="bg-account-avatar text-on-brand flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initialsOf(firstName, lastName)}
    </div>
  );
}

// ---- page headings ----

/** Mobile: back arrow + title. Desktop: "Back to …" link, purple title and a one-line intro. */
export function PageHeading({
  backHref,
  backLabel,
  title,
  mobileTitle,
  intro,
  onMobileBack,
  mobileIntro,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  mobileTitle?: string;
  intro: string;
  onMobileBack?: () => void;
  mobileIntro?: string;
}) {
  const mobileBack = onMobileBack ? (
    <button type="button" onClick={onMobileBack} aria-label="Back" className="flex shrink-0">
      <Icon name="back-mobile.svg" size={22} />
    </button>
  ) : (
    <Link href={backHref} aria-label="Back" className="flex shrink-0">
      <Icon name="back-mobile.svg" size={22} />
    </Link>
  );
  return (
    <>
      <div className="flex flex-col gap-[16px] lg:hidden">
        <div className="flex items-center gap-[10px]">
          {mobileBack}
          <h1 className="text-account-ink truncate text-[22px] leading-normal font-bold">{mobileTitle ?? title}</h1>
        </div>
        {mobileIntro && <p className="text-neutral-550 text-[12px] leading-normal">{mobileIntro}</p>}
      </div>
      <div className="hidden flex-col gap-[4px] lg:flex">
        <Link href={backHref} className="flex w-fit items-center gap-[6px] no-underline">
          <Icon name="back.svg" size={16} />
          <span className="text-brand text-[13px] font-semibold">{backLabel}</span>
        </Link>
        <h1 className="text-brand mt-[8px] text-[24px] leading-normal font-bold">{title}</h1>
        <p className="text-neutral-550 text-[13px] leading-normal">{intro}</p>
      </div>
    </>
  );
}

/** Page padding shared by My Account, Parent and Help. */
export const pageContainer =
  'w-full flex flex-col gap-[16px] lg:gap-[24px] px-[20px] md:px-[40px] lg:px-[90px] pt-[16px] lg:pt-[28px] pb-[32px] lg:pb-[40px] leading-normal';

export const card = 'bg-surface border border-account-line rounded-[16px]';

// ---- skeleton bones ----

export const Bone = ({ className, width }: { className?: string; width?: number }) => (
  <div className={cx('bg-account-bone rounded-[6px]', className)} style={width ? { width } : undefined} />
);

/** Same height as the real text line, with its bone centred, so nothing shifts when the data loads. */
export const Line = ({ height, children, className }: { height: number; children: ReactNode; className?: string }) => (
  <div className={cx('flex items-center', className)} style={{ height }}>
    {children}
  </div>
);

// ---- states ----

export function OfflineBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-warning-soft border-account-offline-line flex items-center gap-[10px] border-b px-[20px] py-[12px] leading-normal md:px-[40px] lg:px-[90px] lg:py-[10px]">
      <StateIcon name="offline" size={18} />
      <p className="text-account-offline-text min-w-0 flex-1 text-[13px] leading-[1.5] font-medium">{message}</p>
      <button type="button" onClick={onRetry} className="text-brand shrink-0 text-[13px] leading-[1.5] font-semibold">
        Retry
      </button>
    </div>
  );
}

export function ErrorState({
  title,
  text,
  onRetry,
  linkLabel,
  onLink,
}: {
  title: string;
  text: string;
  onRetry: () => void;
  linkLabel: string;
  onLink: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center gap-[14px] py-[60px] text-center lg:max-w-[480px]">
      <div className="bg-danger-soft flex size-[56px] items-center justify-center rounded-full">
        <StateIcon name="error" size={26} />
      </div>
      <p className="text-account-ink text-[18px] leading-[1.5] font-bold lg:text-[20px]">{title}</p>
      <p className="text-neutral-550 text-[13px] leading-[1.5] lg:text-[14px]">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bg-brand hover:bg-account-hover text-on-brand flex items-center gap-[8px] rounded-full px-[26px] py-[13px] text-[14px] leading-[1.5] font-semibold transition-colors"
      >
        <StateIcon name="retry" size={16} />
        Try again
      </button>
      <button
        type="button"
        onClick={onLink}
        className="text-brand text-[13px] leading-[1.5] font-semibold hover:underline"
      >
        {linkLabel}
      </button>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex w-full items-start gap-[6px]">
      <StateIcon name="alert" size={14} className="mt-[2px]" />
      <p role="alert" className="text-account-error-text min-w-0 flex-1 text-[12px] leading-[1.5] font-medium">
        {message}
      </p>
    </div>
  );
}

// ---- sheets (bottom sheet on phones, centred dialog on desktop) ----

export const sheetTitle = 'text-account-ink text-[18px] lg:text-[20px] font-bold';
export const sheetText = 'text-neutral-550 text-[12px] lg:text-[13px] leading-[1.5]';
export const outlineButton =
  'w-full py-[13px] rounded-full border border-account-outline bg-surface text-account-ink text-[14px] font-semibold hover:bg-account-soft transition-colors disabled:opacity-60';
export const primaryButton =
  'w-full py-[13px] rounded-full bg-brand hover:bg-account-hover text-on-brand text-[14px] font-semibold transition-colors';
export const dangerButton =
  'w-full py-[13px] rounded-full bg-danger hover:bg-account-error-text text-on-brand text-[14px] font-semibold flex items-center justify-center gap-[8px] transition-colors disabled:opacity-80';

/** Rendered into document.body: the fixed header has its own stacking context. */
function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/** `compact`: tighter desktop spacing so long dialogs fit a laptop screen without scrolling. */
export function Sheet({
  onClose,
  width = 440,
  compact = false,
  label,
  role = 'dialog',
  children,
}: {
  onClose: () => void;
  width?: number;
  compact?: boolean;
  label?: string;
  role?: 'dialog' | 'alertdialog';
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <BodyPortal>
      <div
        className="bg-account-ink/42 lg:bg-account-scrim/40 fixed inset-0 z-[1100] flex items-end justify-center leading-normal lg:items-center lg:px-[16px]"
        onClick={onClose}
      >
        <div
          role={role}
          aria-modal="true"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          style={{ ['--sheet-w' as string]: `${width}px` }}
          className={cx(
            'bg-surface lg:shadow-account-modal flex max-h-[calc(100dvh-24px)] w-full [scrollbar-width:none] flex-col gap-[14px] overflow-y-auto rounded-t-[24px] px-[20px] pt-[12px] pb-[28px] lg:max-w-[var(--sheet-w)] lg:rounded-[24px] [&::-webkit-scrollbar]:hidden',
            compact ? 'lg:gap-[12px] lg:p-[24px]' : 'lg:gap-[16px] lg:p-[28px]',
          )}
        >
          <div className="flex justify-center lg:hidden" aria-hidden="true">
            <span className="bg-account-handle h-[4px] w-[40px] rounded-[2px]" />
          </div>
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}

const ICON_BG = { info: 'bg-account-info-soft', error: 'bg-danger-soft', ok: 'bg-account-ok-soft' } as const;

export function SheetIcon({ name, tone }: { name: string; tone: keyof typeof ICON_BG }) {
  return (
    <div
      className={cx(ICON_BG[tone], 'flex size-[48px] shrink-0 items-center justify-center rounded-full lg:size-[52px]')}
    >
      <Icon name={name} size={22} className="lg:size-[24px]" />
    </div>
  );
}

// ---- toast ----

interface ToastOptions {
  kind?: 'ok' | 'error';
  desktopMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Dark toast: top of the page below the header on desktop, bottom on phones; Undo toasts stay 6 s. */
export function showProfileToast(
  message: string,
  { kind = 'ok', desktopMessage, actionLabel, onAction }: ToastOptions = {},
) {
  const desktop = isDesktop();
  toast.custom(
    (id) => (
      <div
        role="status"
        className="bg-account-ink shadow-account-toast flex w-[calc(100vw-40px)] max-w-[400px] items-center gap-[10px] rounded-[14px] py-[14px] pr-[18px] pl-[16px] leading-normal lg:mt-[72px] lg:w-[380px]"
      >
        <StateIcon name={kind === 'ok' ? 'toast-ok' : 'toast-error'} size={18} />
        <p className="text-on-brand min-w-0 flex-1 text-[13px] leading-[1.5] font-medium">
          {desktop && desktopMessage ? desktopMessage : message}
        </p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              onAction();
            }}
            className="text-account-toast-action shrink-0 text-[13px] leading-[1.5] font-semibold hover:underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
    ),
    { position: desktop ? 'top-center' : 'bottom-center', duration: actionLabel ? 6000 : 4000, unstyled: true },
  );
}
